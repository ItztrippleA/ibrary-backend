import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ContentClient, ContentUpstreamError } from './content.client';
import { ContentQuery } from './dto';
import { presentLesson, presentSummary, presentTopic } from './content.parse';

const CLASSES = ['SS1', 'SS2', 'SS3'];
const THEMES = [1, 2, 3, 4];
const SUBJECTS = ['Biology', 'Chemistry', 'Physics', 'Mathematics', 'English', 'Agricultural Science', 'Basic Science'];
const CACHE_MS = 10 * 60 * 1000;

type Selection = { className: string; subject: string; themeNumber: number };

export type PublishedTopic = ReturnType<typeof presentTopic> & {
  subtopics: ReturnType<typeof presentSummary>[];
};

export type PublishedCatalog = {
  classes: {
    className: string;
    subjects: {
      subject: string;
      themes: { themeNumber: number; topics: PublishedTopic[] }[];
    }[];
  }[];
};

@Injectable()
export class ContentService {
  private catalogCache: { at: number; value: PublishedCatalog } | null = null;
  private catalogFlight: Promise<PublishedCatalog> | null = null;

  constructor(private readonly client: ContentClient) {}

  async catalog(force = false): Promise<PublishedCatalog> {
    if (!force && this.catalogCache && Date.now() - this.catalogCache.at < CACHE_MS) {
      return this.catalogCache.value;
    }
    if (!force && this.catalogFlight) return this.catalogFlight;
    this.catalogFlight = this.buildCatalog()
      .then((value) => {
        this.catalogCache = { at: Date.now(), value };
        return value;
      })
      .finally(() => {
        this.catalogFlight = null;
      });
    return this.catalogFlight;
  }

  topics(query: ContentQuery) {
    const selection = this.selection(query);
    return this.listTopics(selection).then((topics) => ({ ...selection, topics }));
  }

  async topic(topicNumber: number, query: ContentQuery) {
    const selection = this.selection(query);
    const item = await this.read<Record<string, unknown>>(`/topics/${topicNumber}`, selection);
    return { ...selection, ...presentTopic(item) };
  }

  async summaries(topicNumber: number, query: ContentQuery) {
    const selection = this.selection(query);
    const body = await this.read<{ subtopics?: Record<string, unknown>[] }>(
      `/topics/${topicNumber}/subtopics/summary`,
      selection,
    );
    return {
      ...selection,
      topicNumber,
      subtopics: (body.subtopics ?? []).map(presentSummary).sort((a, b) => a.contentIndex - b.contentIndex),
    };
  }

  async subtopics(topicNumber: number, query: ContentQuery) {
    const selection = this.selection(query);
    const body = await this.read<{ subtopics?: Record<string, unknown>[] }>(
      `/topics/${topicNumber}/subtopics`,
      selection,
    );
    return {
      ...selection,
      topicNumber,
      subtopics: (body.subtopics ?? []).map((item) => presentLesson(item, presentSummary(item).contentIndex)),
    };
  }

  async lesson(topicNumber: number, contentIndex: number, query: ContentQuery) {
    const selection = this.selection(query);
    const item = await this.read<Record<string, unknown>>(
      `/topics/${topicNumber}/subtopics/${contentIndex}`,
      selection,
    );
    return { ...selection, topicNumber, ...presentLesson(item, contentIndex) };
  }

  private selection(query: ContentQuery): Selection {
    return {
      className: query.class_name?.trim() || 'SS1',
      subject: query.subject?.trim() || 'Biology',
      themeNumber: query.theme_number ?? 1,
    };
  }

  private async listTopics(selection: Selection) {
    const body = await this.read<{ topics?: Record<string, unknown>[] }>('/topics', selection);
    return (body.topics ?? [])
      .map(presentTopic)
      .filter((topic) => Number.isFinite(topic.topicNumber))
      .sort((a, b) => a.topicNumber - b.topicNumber);
  }

  private async buildCatalog(): Promise<PublishedCatalog> {
    const classes = new Map<string, Map<string, Map<number, PublishedTopic[]>>>();
    for (const className of CLASSES) {
      for (const subject of SUBJECTS) {
        const themes = subject === 'Biology' ? THEMES : [1];
        if (subject !== 'Biology' && className !== 'SS1') continue;
        for (const themeNumber of themes) {
          const selection = { className, subject, themeNumber };
          const topics = await this.listTopics(selection);
          if (!topics.length) continue;
          const published = await Promise.all(
            topics.map(async (topic) => {
              const summary = await this.summaries(topic.topicNumber, {
                class_name: className,
                subject,
                theme_number: themeNumber,
              });
              return { ...topic, subtopics: summary.subtopics };
            }),
          );
          const bySubject = classes.get(className) ?? new Map();
          const byTheme = bySubject.get(subject) ?? new Map();
          byTheme.set(themeNumber, published);
          bySubject.set(subject, byTheme);
          classes.set(className, bySubject);
        }
      }
    }
    return {
      classes: [...classes.entries()].map(([className, subjects]) => ({
        className,
        subjects: [...subjects.entries()].map(([subject, themes]) => ({
          subject,
          themes: [...themes.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([themeNumber, topics]) => ({ themeNumber, topics })),
        })),
      })),
    };
  }

  private async read<T>(path: string, selection: Selection): Promise<T> {
    try {
      return await this.client.get<T>(path, {
        class_name: selection.className,
        theme_number: selection.themeNumber,
        subject: selection.subject,
      });
    } catch (error) {
      if (error instanceof ContentUpstreamError) {
        const body = { message: error.message, api: error.api, token: error.token };
        if (error.status === 404) throw new NotFoundException(body);
        if (error.status === 403) throw new BadGatewayException(body);
        throw new ServiceUnavailableException(body);
      }
      throw error;
    }
  }
}
