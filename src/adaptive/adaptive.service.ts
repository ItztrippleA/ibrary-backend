import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SkillLevel, type User } from '@prisma/client';
import { readEnv } from '../config/env';
import { hidesAnswer, readGlossary } from '../podcasts/lesson';
import { PrismaService } from '../prisma/prisma.service';
import { completionPercent, nextCompetency, skillFor, stepSkill, type SkillName } from './scoring';

type PromptInput = {
  topicId: string;
  difficulty: SkillLevel;
  prompt: string;
  options: string[];
  correctIndex: number;
  hint: string;
};

@Injectable()
export class AdaptiveService {
  constructor(private readonly prisma: PrismaService) {}

  topics(subjectId: string) {
    return this.prisma.topic.findMany({
      where: { subjectId },
      orderBy: { sort: 'asc' },
      include: {
        subtopics: { orderBy: { sort: 'asc' }, select: { id: true, title: true, body: true } },
        _count: { select: { prompts: true, podcasts: true } },
      },
    });
  }

  async topic(id: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, name: true, classLevel: true, term: true } },
        subtopics: { orderBy: { sort: 'asc' } },
        _count: { select: { prompts: true } },
      },
    });
    if (!topic) throw new NotFoundException('Topic not found');
    return {
      ...topic,
      glossary: readGlossary(topic.glossary),
      subtopics: topic.subtopics.map((subtopic) => ({
        ...subtopic,
        glossary: readGlossary(subtopic.glossary),
      })),
    };
  }

  async next(user: User, topicId: string) {
    const topic = await this.prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) throw new NotFoundException('Topic not found');
    const [state, prompts] = await Promise.all([
      this.ensureState(user.id, topicId),
      this.prisma.practicePrompt.findMany({ where: { topicId }, orderBy: { sort: 'asc' } }),
    ]);
    const chosen = this.pick(prompts, state.skill, state.correctIds);
    return {
      state: this.publicState(state),
      prompt: chosen ? this.publicPrompt(chosen, state.skill === 'FOUNDATION' || state.streakWrong > 0) : null,
    };
  }

  async answer(
    user: User,
    topicId: string,
    input: { promptId: string; selected: number; seconds: number; confidence?: number },
  ) {
    const prompt = await this.prisma.practicePrompt.findFirst({
      where: { id: input.promptId, topicId },
    });
    if (!prompt) throw new NotFoundException('Question not found');
    if (input.selected >= prompt.options.length) {
      throw new BadRequestException('Selected option is out of range');
    }
    const state = await this.ensureState(user.id, topicId);
    const correct = input.selected === prompt.correctIndex;
    const competency = nextCompetency(state.competency, correct, input.seconds);
    const streakWrong = correct ? 0 : state.streakWrong + 1;
    const answeredIds = Array.from(new Set([...state.answeredIds, prompt.id]));
    const correctIds = correct
      ? Array.from(new Set([...state.correctIds, prompt.id]))
      : state.correctIds.filter((id) => id !== prompt.id);
    const pool = await this.prisma.practicePrompt.count({ where: { topicId } });
    const saved = await this.prisma.learnerState.update({
      where: { id: state.id },
      data: {
        attempts: { increment: 1 },
        correct: { increment: correct ? 1 : 0 },
        incorrect: { increment: correct ? 0 : 1 },
        timeSpentSeconds: { increment: input.seconds },
        confidence: input.confidence ?? state.confidence,
        competency,
        skill: skillFor(competency, streakWrong),
        streakWrong,
        completion: completionPercent(correctIds, pool),
        lastMiss: correct ? state.lastMiss : prompt.hint,
        answeredIds,
        correctIds,
      },
    });
    const recommendation = await this.recommendations(user.id);
    return {
      correct,
      message: correct
        ? 'That holds. Try the next step when you are ready.'
        : 'Not yet. Use the hint, then try again. The answer stays yours to find.',
      hint: correct ? null : prompt.hint,
      state: this.publicState(saved),
      recommendation: recommendation[0] ?? null,
    };
  }

  async coach(user: User, topicId: string, note?: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      include: { prompts: true, subject: { select: { name: true } } },
    });
    if (!topic) throw new NotFoundException('Topic not found');
    const state = await this.ensureState(user.id, topicId);
    const answers = topic.prompts.map((prompt) => prompt.options[prompt.correctIndex] ?? '');
    const rules = this.rulesCoach(topic.title, state.skill, state.competency, state.lastMiss, note);
    const env = readEnv();
    if (!env.openaiApiKey) return { source: 'rules' as const, ...rules };

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: env.openaiModel,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are a learning coach for a Nigerian secondary-school student. Never state the correct option, the final answer, or a worked solution. Ask one prompting question. If the student is struggling, offer a simpler everyday picture and a smaller step. Return JSON {"message":"...","question":"..."}.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                topic: topic.title,
                subject: topic.subject.name,
                skill: state.skill,
                competency: state.competency,
                recentMissHint: state.lastMiss,
                studentNote: note ?? '',
                request: 'Guide the student. Do not reveal an answer.',
              }),
            },
          ],
        }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) return { source: 'rules' as const, ...rules };
      const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? '{}') as {
        message?: unknown;
        question?: unknown;
      };
      const message = typeof parsed.message === 'string' ? parsed.message : '';
      const question = typeof parsed.question === 'string' ? parsed.question : '';
      const combined = `${message} ${question}`;
      if (!message || !question || answers.some((answer) => answer && !hidesAnswer(combined, answer))) {
        return { source: 'rules' as const, ...rules };
      }
      return { source: 'openai' as const, message, question };
    } catch {
      return { source: 'rules' as const, ...rules };
    }
  }

  async recommendations(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const states = await this.prisma.learnerState.findMany({
      where: { userId, competency: { lt: 60 } },
      orderBy: { competency: 'asc' },
      take: 3,
      include: { topic: { include: { subject: { select: { name: true, classLevel: true, term: true } } } } },
    });
    const rows = states.map((state) => ({
      topicId: state.topicId,
      title: state.topic.title,
      subject: state.topic.subject.name,
      reason: `Competency is ${state.competency}. A simpler step will hold the idea before the next quiz.`,
      nextStep: state.lastMiss ?? 'Answer one foundation question before moving on.',
    }));
    if (rows.length >= 3 || !user) return rows;
    const started = new Set(states.map((state) => state.topicId));
    const fresh = await this.prisma.topic.findMany({
      where: {
        id: { notIn: Array.from(started) },
        ...(user.classLevel ? { subject: { classLevel: user.classLevel } } : {}),
      },
      take: 3 - rows.length,
      orderBy: { title: 'asc' },
      include: { subject: { select: { name: true } } },
    });
    return [
      ...rows,
      ...fresh.map((topic) => ({
        topicId: topic.id,
        title: topic.title,
        subject: topic.subject.name,
        reason: 'This topic is still open.',
        nextStep: 'Listen to the overview, then try one foundation question.',
      })),
    ];
  }

  async desk() {
    const [topics, states] = await Promise.all([
      this.prisma.topic.findMany({
        orderBy: { title: 'asc' },
        include: {
          subject: { select: { id: true, name: true, classLevel: true, term: true } },
          subtopics: { orderBy: { sort: 'asc' }, select: { id: true, title: true } },
          prompts: { orderBy: [{ difficulty: 'asc' }, { sort: 'asc' }] },
        },
      }),
      this.prisma.learnerState.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 30,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          topic: { select: { title: true } },
        },
      }),
    ]);
    return {
      openai: Boolean(readEnv().openaiApiKey),
      topics,
      states,
    };
  }

  async createTopic(input: {
    subjectId: string;
    title: string;
    summary: string;
    objectives: string[];
    glossary: { term: string; meaning: string }[];
  }) {
    const subject = await this.prisma.subject.findUnique({ where: { id: input.subjectId } });
    if (!subject) throw new NotFoundException('Subject not found');
    const slug = await this.freeSlug(input.title, async (value) =>
      Boolean(await this.prisma.topic.findUnique({ where: { subjectId_slug: { subjectId: subject.id, slug: value } } })),
    );
    const sort = await this.prisma.topic.count({ where: { subjectId: subject.id } });
    return this.prisma.topic.create({
      data: {
        subjectId: subject.id,
        slug,
        title: input.title.trim(),
        summary: input.summary.trim(),
        objectives: input.objectives,
        glossary: input.glossary as unknown as Prisma.InputJsonValue,
        sort,
      },
    });
  }

  async createSubtopic(
    topicId: string,
    input: { title: string; body: string; objectives: string[]; glossary: { term: string; meaning: string }[] },
  ) {
    const topic = await this.prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) throw new NotFoundException('Topic not found');
    const slug = await this.freeSlug(input.title, async (value) =>
      Boolean(await this.prisma.subtopic.findUnique({ where: { topicId_slug: { topicId, slug: value } } })),
    );
    const sort = await this.prisma.subtopic.count({ where: { topicId } });
    return this.prisma.subtopic.create({
      data: {
        topicId,
        slug,
        title: input.title.trim(),
        body: input.body.trim(),
        objectives: input.objectives,
        glossary: input.glossary as unknown as Prisma.InputJsonValue,
        sort,
      },
    });
  }

  async createPrompt(input: PromptInput) {
    const topic = await this.prisma.topic.findUnique({ where: { id: input.topicId } });
    if (!topic) throw new NotFoundException('Topic not found');
    if (input.correctIndex >= input.options.length) {
      throw new BadRequestException('The correct option is out of range');
    }
    const sort = await this.prisma.practicePrompt.count({ where: { topicId: topic.id } });
    return this.prisma.practicePrompt.create({
      data: { ...input, prompt: input.prompt.trim(), hint: input.hint.trim(), sort },
    });
  }

  async removePrompt(id: string) {
    const row = await this.prisma.practicePrompt.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Question not found');
    await this.prisma.practicePrompt.delete({ where: { id } });
    return { deleted: true };
  }

  private pick<T extends { id: string; difficulty: SkillLevel }>(
    prompts: T[],
    skill: SkillLevel,
    correctIds: string[],
  ) {
    const levels: SkillName[] = [skill, stepSkill(skill, -1), stepSkill(skill, 1)];
    for (const level of levels) {
      const open = prompts.filter((prompt) => prompt.difficulty === level && !correctIds.includes(prompt.id));
      if (open[0]) return open[0];
    }
    return null;
  }

  private publicPrompt(
    prompt: { id: string; difficulty: SkillLevel; prompt: string; options: string[]; hint: string },
    withHint: boolean,
  ) {
    return {
      id: prompt.id,
      difficulty: prompt.difficulty,
      prompt: prompt.prompt,
      options: prompt.options,
      hint: withHint ? prompt.hint : null,
    };
  }

  private publicState(state: {
    competency: number;
    skill: SkillLevel;
    completion: number;
    attempts: number;
    confidence: number | null;
    streakWrong: number;
    timeSpentSeconds: number;
  }) {
    return {
      competency: state.competency,
      skill: state.skill,
      completion: state.completion,
      attempts: state.attempts,
      confidence: state.confidence,
      streakWrong: state.streakWrong,
      timeSpentSeconds: state.timeSpentSeconds,
    };
  }

  private rulesCoach(title: string, skill: SkillLevel, competency: number, hint: string | null, note?: string) {
    const picture = hint
      ? `Hold this picture, and do not jump to an option yet: ${hint}`
      : `Restate ${title} as something you have seen at home or in the market.`;
    const asked = note?.trim()
      ? `You asked about “${note.trim()}”. Say which part of the picture that touches.`
      : 'Name the part you are sure of before you choose.';
    return {
      message: `You are on ${title}. The current step is ${skill.toLowerCase()}, from a competency of ${competency}. ${picture} ${asked}`,
      question: 'What is moving in this idea, and what is being held back?',
    };
  }

  private async ensureState(userId: string, topicId: string) {
    return this.prisma.learnerState.upsert({
      where: { userId_topicId: { userId, topicId } },
      create: { userId, topicId },
      update: {},
    });
  }

  private async freeSlug(title: string, taken: (slug: string) => Promise<boolean>) {
    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'topic';
    let slug = base;
    let n = 2;
    while (await taken(slug)) slug = `${base}-${n++}`;
    return slug;
  }
}
