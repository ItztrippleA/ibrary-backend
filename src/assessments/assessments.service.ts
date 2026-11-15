import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClassLevel, NotificationType, Prisma, User } from '@prisma/client';
import { GamificationService } from '../gamification/gamification.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssessmentAnswerDto } from './dto/submit-assessment.dto';

const CLASS_LEVELS = new Set<string>(Object.values(ClassLevel));

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
    private readonly notifications: NotificationsService,
  ) {}

  list(user: User) {
    const or: Prisma.AssessmentWhereInput[] = [{ onboarding: true }, { classLevel: null }];
    if (user.classLevel) or.push({ classLevel: user.classLevel });
    return this.prisma.assessment.findMany({
      where: { OR: or },
      orderBy: [{ onboarding: 'desc' }, { title: 'asc' }],
      include: { _count: { select: { questions: true } } },
    });
  }

  async practiceCatalog(className?: string, subject?: string) {
    const classLevel = parseClassLevel(className);
    const rows = await this.prisma.assessment.findMany({
      where: {
        onboarding: false,
        ...(classLevel ? { classLevel } : {}),
      },
      orderBy: [{ title: 'asc' }],
      include: { _count: { select: { questions: true } } },
    });

    const subjectFilter = subject?.trim().toLowerCase();
    const topics = rows
      .map((row) => {
        const meta = parseAssessmentMeta(row.description, row.slug);
        return {
          slug: row.slug,
          title: row.title,
          theme: meta.theme,
          themeNumber: meta.themeNumber,
          topicNumber: meta.topicNumber,
          questionCount: row._count.questions,
          classLevel: row.classLevel,
          subject: meta.subject,
        };
      })
      .filter((topic) => !subjectFilter || topic.subject.toLowerCase() === subjectFilter)
      .filter((topic) => topic.questionCount > 0);

    const bySubject = new Map<string, typeof topics>();
    for (const topic of topics) {
      const list = bySubject.get(topic.subject) ?? [];
      list.push(topic);
      bySubject.set(topic.subject, list);
    }

    for (const list of bySubject.values()) {
      list.sort((a, b) => a.themeNumber - b.themeNumber || a.topicNumber - b.topicNumber || a.title.localeCompare(b.title));
    }

    return {
      subjects: [...bySubject.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, subjectTopics]) => ({ subject: name, topics: subjectTopics })),
    };
  }

  async practiceQuiz(slug: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { slug },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    if (!assessment || assessment.onboarding) {
      throw new NotFoundException('Quiz not found');
    }

    const meta = parseAssessmentMeta(assessment.description, assessment.slug);
    return {
      slug: assessment.slug,
      title: assessment.title,
      subject: meta.subject,
      theme: meta.theme,
      themeNumber: meta.themeNumber,
      topicNumber: meta.topicNumber,
      classLevel: assessment.classLevel,
      contentIndex: meta.topicNumber || 0,
      questions: assessment.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        options: question.options.map((text, index) => ({
          id: String.fromCharCode(65 + index),
          text,
        })),
        correctOptionId: String.fromCharCode(65 + question.correctIndex),
      })),
    };
  }

  async onboarding() {
    const assessment = await this.prisma.assessment.findFirst({
      where: { onboarding: true },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    if (!assessment) throw new NotFoundException('Onboarding assessment is not seeded');
    return this.withoutAnswers(assessment);
  }

  async one(id: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    return this.withoutAnswers(assessment);
  }

  attempts(userId: string) {
    return this.prisma.assessmentAttempt.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      include: { assessment: { select: { id: true, title: true, slug: true } } },
    });
  }

  async submit(user: User, assessmentId: string, answers: AssessmentAnswerDto[]) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { questions: true },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (answers.length !== assessment.questions.length) {
      throw new BadRequestException('Answer every question');
    }

    const byId = new Map(assessment.questions.map((question) => [question.id, question]));
    let score = 0;
    const graded = answers.map((answer) => {
      const question = byId.get(answer.questionId);
      if (!question) throw new BadRequestException('Unknown question');
      if (answer.selected >= question.options.length) {
        throw new BadRequestException('Selected option is out of range');
      }
      const correct =
        question.correctIndex < 0 || answer.selected === question.correctIndex;
      if (correct) score += 1;
      return { question, selected: answer.selected, correct };
    });

    const prior = await this.prisma.assessmentAttempt.count({
      where: { userId: user.id, assessmentId },
    });

    const attempt = await this.prisma.assessmentAttempt.create({
      data: {
        userId: user.id,
        assessmentId,
        score,
        total: assessment.questions.length,
        answers: {
          create: graded.map((row) => ({
            questionId: row.question.id,
            selected: row.selected,
            correct: row.correct,
          })),
        },
      },
    });

    await this.applyOnboardingAnswers(user.id, graded);

    if (prior === 0) {
      await this.gamification.awardPoints(
        user.id,
        40,
        `Completed ${assessment.title}`,
      );
    }

    await this.prisma.activity.create({
      data: {
        userId: user.id,
        title: assessment.title,
        detail: `Scored ${score} of ${assessment.questions.length}`,
      },
    });

    await this.notifications.notify({
      user,
      type: NotificationType.ASSESSMENT_RESULT,
      title: 'Assessment result',
      body: `You scored ${score} of ${assessment.questions.length} on ${assessment.title}.`,
      email: {
        subject: `Your ${assessment.title} result`,
        html: `<p>Hi ${user.firstName}, you scored ${score} of ${assessment.questions.length}.</p>`,
      },
    });

    return {
      attemptId: attempt.id,
      score,
      total: assessment.questions.length,
      passed: score / assessment.questions.length >= 0.5,
    };
  }

  private async applyOnboardingAnswers(
    userId: string,
    graded: { question: { prompt: string; options: string[] }; selected: number }[],
  ) {
    const data: { classLevel?: ClassLevel; classPath?: string } = {};
    for (const row of graded) {
      const choice = row.question.options[row.selected];
      if (row.question.options.every((option) => CLASS_LEVELS.has(option))) {
        data.classLevel = choice as ClassLevel;
      }
      if (/class path/i.test(row.question.prompt)) {
        data.classPath = choice;
      }
    }
    if (data.classLevel || data.classPath) {
      await this.prisma.user.update({ where: { id: userId }, data });
    }
  }

  private withoutAnswers<T extends { questions: { correctIndex: number }[] }>(
    assessment: T,
  ) {
    return {
      ...assessment,
      questions: assessment.questions.map(({ correctIndex: _hidden, ...question }) => question),
    };
  }
}

function parseClassLevel(value?: string): ClassLevel | undefined {
  if (!value?.trim()) return undefined;
  const key = value.trim().toUpperCase().replace(/\s+/g, '');
  const match = key.match(/^(JSS|SSS|SS)([123])$/);
  if (!match) return undefined;
  const prefix = match[1] === 'JSS' ? 'JSS' : 'SS';
  const level = `${prefix}${match[2]}`;
  return (Object.values(ClassLevel) as string[]).includes(level) ? (level as ClassLevel) : undefined;
}

function parseAssessmentMeta(description: string, slug: string) {
  const parts = description.split(' · ').map((part) => part.trim()).filter(Boolean);
  const subject = parts[0] && !parts[0].startsWith('WAEC') && !parts[0].startsWith('theme:') ? parts[0] : 'General';
  const theme =
    parts.find((part) => !part.startsWith('WAEC') && !part.startsWith('theme:') && part !== subject) ?? '';
  const themeMeta = parts.find((part) => part.startsWith('theme:')) ?? '';
  const themeMatch = themeMeta.match(/theme:(\d+)\|topic:(\d+)/);
  const slugMatch = slug.match(/theme(\d+).*topic(\d+)/i);
  return {
    subject,
    theme,
    themeNumber: themeMatch ? Number(themeMatch[1]) : slugMatch ? Number(slugMatch[1]) : 0,
    topicNumber: themeMatch ? Number(themeMatch[2]) : slugMatch ? Number(slugMatch[2]) : 0,
  };
}
