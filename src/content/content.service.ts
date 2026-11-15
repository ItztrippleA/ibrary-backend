import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CONTENT_CLASSES, toApiClassName, toDisplayClassName } from './class-names';
import { ContentClient, ContentUpstreamError } from './content.client';
import { ContentQuery } from './dto';
import { presentLesson, presentSummary, presentTopic } from './content.parse';

const THEMES = [1, 2, 3, 4];
const SUBJECTS = ['Biology', 'Chemistry', 'Physics', 'Mathematics', 'English', 'Agricultural Science', 'Basic Science'];
const CACHE_MS = 10 * 60 * 1000;

type Selection = {
  /** Shown in the app: SS1 / SS2 / SS3 */
  className: string;
  /** Sent to the content API: SSS 1 / SSS 2 / SSS 3 */
  apiClassName: string;
  subject: string;
  themeNumber: number;
};

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
    return this.listTopics(selection).then((topics) => ({
      className: selection.className,
      subject: selection.subject,
      themeNumber: selection.themeNumber,
      topics,
    }));
  }

  async topic(topicNumber: number, query: ContentQuery) {
    const selection = this.selection(query);
    // Content API v2: native JSON fields (same route shape as v1).
    const item = await this.read<Record<string, unknown>>(`/v2/topics/${topicNumber}`, selection);
    return {
      className: selection.className,
      subject: selection.subject,
      themeNumber: selection.themeNumber,
      ...presentTopic(item),
    };
  }

  async summaries(topicNumber: number, query: ContentQuery) {
    const selection = this.selection(query);
    const body = await this.read<{ subtopics?: Record<string, unknown>[] }>(
      `/v2/topics/${topicNumber}/subtopics/summary`,
      selection,
    );
    return {
      className: selection.className,
      subject: selection.subject,
      themeNumber: selection.themeNumber,
      topicNumber,
      subtopics: (body.subtopics ?? []).map(presentSummary).sort((a, b) => a.sk.localeCompare(b.sk)),
    };
  }

  async subtopics(topicNumber: number, query: ContentQuery) {
    const selection = this.selection(query);
    // List lessons for a topic. Rows share PK; SK (TOPIC#NN#CONTENT#M) is the unique id.
    const body = await this.read<{ subtopics?: Record<string, unknown>[] }>(
      `/v2/topics/${topicNumber}/subtopics`,
      selection,
    );
    return {
      className: selection.className,
      subject: selection.subject,
      themeNumber: selection.themeNumber,
      topicNumber,
      subtopics: (body.subtopics ?? [])
        .map((item) => presentLesson(item))
        .sort((a, b) => a.sk.localeCompare(b.sk)),
    };
  }

  async lesson(topicNumber: number, contentIndex: number, query: ContentQuery) {
    const selection = this.selection(query);
    // OpenAPI: get_subtopic — path content_index from `_content{N}` / CONTENT#{N}.
    const item = await this.read<Record<string, unknown>>(
      `/v2/topics/${topicNumber}/subtopics/${contentIndex}`,
      selection,
    );
    return {
      className: selection.className,
      subject: selection.subject,
      themeNumber: selection.themeNumber,
      topicNumber,
      ...presentLesson(item, contentIndex),
    };
  }

  private selection(query: ContentQuery): Selection {
    const apiClassName = toApiClassName(query.class_name);
    return {
      className: toDisplayClassName(apiClassName),
      apiClassName,
      subject: query.subject?.trim() || 'Biology',
      themeNumber: query.theme_number ?? 1,
    };
  }

  private async listTopics(selection: Selection) {
    const body = await this.read<{ topics?: Record<string, unknown>[] }>('/v2/topics', selection);
    return (body.topics ?? [])
      .map(presentTopic)
      .filter((topic) => Number.isFinite(topic.topicNumber))
      .sort((a, b) => a.topicNumber - b.topicNumber);
  }

  private async buildCatalog(): Promise<PublishedCatalog> {
    const classes = new Map<string, Map<string, Map<number, PublishedTopic[]>>>();
    // Render can sleep ~50s. One wake call up front so the scan below is not
    // charged a cold start on every empty subject/theme combo.
    try {
      await this.listTopics({
        className: 'SS1',
        apiClassName: 'SSS 1',
        subject: 'Biology',
        themeNumber: 1,
      });
    } catch {
      // Still try the scan; individual misses are skipped below.
    }
    for (const { label, api } of CONTENT_CLASSES) {
      for (const subject of SUBJECTS) {
        const themes = subject === 'Biology' ? THEMES : [1];
        if (subject !== 'Biology' && label !== 'SS1') continue;
        for (const themeNumber of themes) {
          const selection: Selection = {
            className: label,
            apiClassName: api,
            subject,
            themeNumber,
          };
          let topics: Awaited<ReturnType<ContentService['listTopics']>> = [];
          try {
            topics = await this.listTopics(selection);
          } catch {
            continue;
          }
          if (!topics.length) continue;
          const published = await Promise.all(
            topics.map(async (topic) => {
              try {
                const summary = await this.summaries(topic.topicNumber, {
                  class_name: label,
                  subject,
                  theme_number: themeNumber,
                });
                return { ...topic, subtopics: summary.subtopics };
              } catch {
                return { ...topic, subtopics: [] };
              }
            }),
          );
          const bySubject = classes.get(label) ?? new Map();
          const byTheme = bySubject.get(subject) ?? new Map();
          byTheme.set(themeNumber, published);
          bySubject.set(subject, byTheme);
          classes.set(label, bySubject);
        }
      }
    }
    return {
      classes: CONTENT_CLASSES.map(({ label }) => {
        const subjects = classes.get(label) ?? new Map();
        return {
          className: label,
          subjects: [...subjects.entries()].map(([subject, themes]) => ({
            subject,
            themes: [...themes.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([themeNumber, topics]) => ({ themeNumber, topics })),
          })),
        };
      }),
    };
  }

  private async read<T>(path: string, selection: Selection): Promise<T> {
    try {
      return await this.client.get<T>(path, {
        class_name: selection.apiClassName,
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
