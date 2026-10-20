import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ScriptSource, type User } from '@prisma/client';
import { readEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/object-storage';
import {
  focusHash,
  normalFocus,
  readGlossary,
  readTurns,
  writeLessonScript,
  type Turn,
} from './lesson';
import { speakTurns, systemVoiceAvailable } from './speech';

const running = new Set<string>();

type RequestInput = {
  topicId?: string;
  subtopicId?: string;
  focus?: string;
  force?: boolean;
};

@Injectable()
export class PodcastsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async request(user: User, input: RequestInput) {
    const target = await this.resolve(input.topicId, input.subtopicId);
    const focus = normalFocus(input.focus ?? '');
    const hash = focusHash(focus);
    const existing = await this.prisma.podcast.findUnique({
      where: { targetKey_focusHash: { targetKey: target.targetKey, focusHash: hash } },
    });
    if (existing && !input.force && existing.status !== 'FAILED' && !this.stale(existing.updatedAt, existing.status)) {
      return this.present(existing.id);
    }

    const row = existing
      ? await this.prisma.podcast.update({
          where: { id: existing.id },
          data: {
            status: 'QUEUED',
            focus,
            script: [],
            error: null,
            note: '',
            audioKey: null,
            audioUrl: null,
            voiceSource: 'NONE',
            requestedById: user.id,
          },
        })
      : await this.prisma.podcast.create({
          data: {
            topicId: target.topicId,
            subtopicId: target.subtopicId,
            targetKey: target.targetKey,
            focusHash: hash,
            focus,
            script: [],
            requestedById: user.id,
          },
        });

    void this.produce(row.id);
    return this.present(row.id);
  }

  async one(id: string, user: User) {
    const row = await this.present(id);
    const access = await this.prisma.userAccess.findUnique({ where: { userId: user.id } });
    return { ...row, speechRate: access?.speechRate ?? 1 };
  }

  async list() {
    const episodes = await this.prisma.podcast.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: {
        topic: { select: { id: true, title: true, subject: { select: { name: true, classLevel: true, term: true } } } },
        subtopic: { select: { id: true, title: true } },
      },
    });
    return Promise.all(episodes.map((episode) => this.shape(episode)));
  }

  async remove(id: string) {
    const row = await this.prisma.podcast.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Podcast not found');
    await this.prisma.podcast.delete({ where: { id } });
    return { deleted: true };
  }

  async voices() {
    return {
      openai: Boolean(readEnv().openaiApiKey),
      system: await systemVoiceAvailable(),
    };
  }

  private async produce(id: string) {
    if (running.has(id)) return;
    running.add(id);
    try {
      await this.prisma.podcast.update({ where: { id }, data: { status: 'SCRIPTING', error: null } });
      const row = await this.prisma.podcast.findUnique({
        where: { id },
        include: {
          topic: { include: { subject: true } },
          subtopic: true,
        },
      });
      if (!row) return;
      const brief = {
        title: row.subtopic?.title ?? row.topic.title,
        subject: `${row.topic.subject.name}, ${row.topic.subject.classLevel} term ${row.topic.subject.term}`,
        summary: row.topic.summary,
        objectives: row.subtopic?.objectives.length ? row.subtopic.objectives : row.topic.objectives,
        glossary: readGlossary(row.subtopic?.glossary ?? row.topic.glossary),
        focus: row.focus,
        body: row.subtopic?.body,
      };
      const written = await this.writeScript(brief);
      await this.prisma.podcast.update({
        where: { id },
        data: {
          status: 'VOICING',
          script: written.turns as unknown as Prisma.InputJsonValue,
          scriptSource: written.source,
          note: written.note,
        },
      });
      const spoken = await speakTurns(written.turns, readEnv()).catch(() => null);
      if (!spoken) {
        await this.prisma.podcast.update({
          where: { id },
          data: {
            status: 'READY',
            voiceSource: 'NONE',
            note: written.note || 'The script is ready. Recorded voices need an OpenAI key, or the system voice on this machine.',
          },
        });
        return;
      }
      const stored = await this.storage.put({
        folder: 'podcasts',
        filename: `${id}.${spoken.extension}`,
        contentType: spoken.contentType,
        body: spoken.body,
      });
      await this.prisma.podcast.update({
        where: { id },
        data: {
          status: 'READY',
          voiceSource: spoken.source,
          audioKey: stored.key,
          audioUrl: stored.url,
          note: written.note,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The podcast could not be made';
      await this.prisma.podcast.update({
        where: { id },
        data: { status: 'FAILED', error: message },
      }).catch(() => undefined);
    } finally {
      running.delete(id);
    }
  }

  private async writeScript(brief: Parameters<typeof writeLessonScript>[0]): Promise<{
    turns: Turn[];
    source: ScriptSource;
    note: string;
  }> {
    const env = readEnv();
    if (!env.openaiApiKey) {
      return { turns: writeLessonScript(brief), source: 'LESSON', note: '' };
    }
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
                'Write a two-person secondary-school podcast. Speakers are "guide" and "student". Return JSON {"turns":[{"speaker":"guide"|"student","text":"..."}]}. 8 to 12 short turns. Use natural talk, a pause-friendly sentence, and a vivid Nigerian everyday picture. Do not read the lesson verbatim. If a focus is provided, keep the conversation on that focus. Do not give assessment answers.',
            },
            { role: 'user', content: JSON.stringify(brief) },
          ],
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) throw new Error('Script request failed');
      const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? '{}') as { turns?: unknown };
      const turns = readTurns(parsed.turns);
      if (turns.length < 6) throw new Error('Script was too short');
      return { turns: turns.slice(0, 12), source: 'OPENAI', note: '' };
    } catch {
      return {
        turns: writeLessonScript(brief),
        source: 'LESSON',
        note: 'The model script was not usable, so the lesson script was used instead.',
      };
    }
  }

  private async resolve(topicId?: string, subtopicId?: string) {
    if (Boolean(topicId) === Boolean(subtopicId)) {
      throw new BadRequestException('Choose a topic or a subtopic');
    }
    if (subtopicId) {
      const subtopic = await this.prisma.subtopic.findUnique({ where: { id: subtopicId } });
      if (!subtopic) throw new NotFoundException('Subtopic not found');
      return { topicId: subtopic.topicId, subtopicId: subtopic.id, targetKey: `subtopic:${subtopic.id}` };
    }
    const topic = await this.prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) throw new NotFoundException('Topic not found');
    return { topicId: topic.id, subtopicId: null, targetKey: `topic:${topic.id}` };
  }

  private stale(updatedAt: Date, status: string) {
    if (status === 'READY' || status === 'FAILED') return false;
    return Date.now() - updatedAt.getTime() > 10 * 60 * 1000;
  }

  private async present(id: string) {
    const row = await this.prisma.podcast.findUnique({
      where: { id },
      include: {
        topic: { select: { id: true, title: true, subject: { select: { name: true, classLevel: true, term: true } } } },
        subtopic: { select: { id: true, title: true } },
      },
    });
    if (!row) throw new NotFoundException('Podcast not found');
    return this.shape(row);
  }

  private shape(row: {
    id: string;
    topicId: string;
    subtopicId: string | null;
    focus: string;
    status: string;
    script: Prisma.JsonValue;
    scriptSource: string;
    voiceSource: string;
    audioUrl: string | null;
    note: string;
    error: string | null;
    createdAt: Date;
    topic: { id: string; title: string; subject: { name: string; classLevel: string; term: number } };
    subtopic: { id: string; title: string } | null;
  }) {
    return {
      id: row.id,
      topicId: row.topicId,
      subtopicId: row.subtopicId,
      title: row.subtopic?.title ?? row.topic.title,
      subject: row.topic.subject,
      focus: row.focus,
      status: row.status,
      script: readTurns(row.script),
      scriptSource: row.scriptSource,
      voiceSource: row.voiceSource,
      audioUrl: row.audioUrl,
      note: row.note,
      error: row.error,
      createdAt: row.createdAt,
    };
  }
}
