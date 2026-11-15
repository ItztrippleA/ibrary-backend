export type GlossaryEntry = { term: string; definition: string };

export function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function parseStringList(value: unknown): string[] {
  const parsed = parseJsonField<unknown>(value, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((item) => (typeof item === 'string' ? item : JSON.stringify(item)));
}

export function parseGlossary(value: unknown): GlossaryEntry[] {
  const parsed = parseJsonField<unknown>(value, []);
  if (Array.isArray(parsed)) {
    return parsed.map((item) => {
      if (typeof item === 'string') return { term: item, definition: '' };
      if (item && typeof item === 'object') {
        const row = item as Record<string, unknown>;
        return {
          term: String(row.term ?? row.name ?? ''),
          definition: String(row.definition ?? row.meaning ?? ''),
        };
      }
      return { term: String(item), definition: '' };
    });
  }
  if (parsed && typeof parsed === 'object') {
    return Object.entries(parsed as Record<string, unknown>).map(([term, definition]) => ({
      term,
      definition: String(definition ?? ''),
    }));
  }
  return [];
}

export function contentIndexFromSk(sk: string): number {
  const match = /CONTENT#(\d+)$/.exec(sk);
  return match ? Number(match[1]) : Number.NaN;
}

/** content_index from unit id `…_content{N}` (OpenAPI path docs). */
export function contentIndexFromUnitId(unitId: string): number {
  const match = /_content(\d+)$/i.exec(unitId);
  return match ? Number(match[1]) : Number.NaN;
}

export function contentIndexFromItem(item: Record<string, unknown>): number {
  const fromSk = contentIndexFromSk(String(item.SK ?? ''));
  if (Number.isFinite(fromSk)) return fromSk;
  const fromUnit = contentIndexFromUnitId(String(item.curriculum_unit_id ?? ''));
  if (Number.isFinite(fromUnit)) return fromUnit;
  return 0;
}

export type LessonImage = {
  id: string;
  url: string;
  caption: string;
  altText: string;
};

const CONTENT_S3_PREFIX = 's3://ibrary-content/';
const CONTENT_PUBLIC_BASE =
  'https://lajxoepgscwdsqbipeyt.supabase.co/storage/v1/object/public/ibrary-content/';

/** v2 uses https `url`; v1 uses `s3_url` — rewrite the published bucket to the public CDN. */
export function publicImageUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith(CONTENT_S3_PREFIX)) {
    return `${CONTENT_PUBLIC_BASE}${value.slice(CONTENT_S3_PREFIX.length)}`;
  }
  return null;
}

export function presentImages(value: unknown): LessonImage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const item = row as Record<string, unknown>;
      const url = publicImageUrl(String(item.url ?? item.s3_url ?? ''));
      if (!url) return null;
      return {
        id: String(item.image_id ?? url),
        url,
        caption: String(item.caption ?? ''),
        altText: String(item.alt_text ?? item.caption ?? 'Lesson figure'),
      };
    })
    .filter((item): item is LessonImage => item != null);
}

export function presentChecklist(value: unknown): string | undefined {
  const parsed = parseJsonField<unknown>(value, null);
  if (parsed == null || parsed === '') return undefined;
  if (typeof parsed === 'string') return parsed;
  if (Array.isArray(parsed)) return parsed.map((item) => String(item)).filter(Boolean).join('. ');
  if (typeof parsed === 'object') {
    return Object.entries(parsed as Record<string, unknown>)
      .map(([key, item]) => `${key}: ${typeof item === 'string' ? item : JSON.stringify(item)}`)
      .join('. ');
  }
  return String(parsed);
}

export function presentTopic(item: Record<string, unknown>) {
  const objectives = parseStringList(item.learning_objectives);
  const title = String(item.title || item.topic || 'Topic');
  const curriculumLabel = item.topic ? String(item.topic) : '';
  return {
    topicNumber: Number(item.topic_number),
    title,
    description: curriculumLabel && curriculumLabel !== title ? curriculumLabel : objectives[0] ?? '',
    objectives,
    glossary: parseGlossary(item.glossary_terms),
  };
}

/** Stable lesson id: SK is unique per row; PK is shared across a theme. */
export function skFromItem(item: Record<string, unknown>): string {
  const sk = String(item.SK ?? '').trim();
  if (sk) return sk;
  const index = contentIndexFromItem(item);
  const topic = Number(item.topic_number);
  const topicPart = Number.isFinite(topic) ? String(topic).padStart(2, '0') : '00';
  return `TOPIC#${topicPart}#CONTENT#${index}`;
}

export function presentSummary(item: Record<string, unknown>) {
  const sk = skFromItem(item);
  const fromSk = contentIndexFromSk(sk);
  return {
    sk,
    contentIndex: Number.isFinite(fromSk) ? fromSk : contentIndexFromItem(item),
    title: String(item.subtopic ?? 'Lesson'),
  };
}

export function presentLesson(item: Record<string, unknown>, contentIndex?: number) {
  const sk = skFromItem(item);
  const fromSk = contentIndexFromSk(sk);
  const index = Number.isFinite(contentIndex)
    ? Number(contentIndex)
    : Number.isFinite(fromSk)
      ? fromSk
      : contentIndexFromItem(item);
  return {
    sk,
    contentIndex: index,
    title: String(item.subtopic ?? 'Lesson'),
    contentMarkdown: String(item.curated_content_md ?? ''),
    keyTakeaways: parseStringList(item.key_takeaways),
    glossary: parseGlossary(item.glossary_terms),
    activities: parseStringList(item.student_activities),
    teacherActivities: parseStringList(item.teacher_activities),
    accessibilityContext: presentChecklist(item.accessibility_checklist),
    images: presentImages(item.images),
    textbookRefs: parseJsonField<unknown[]>(item.textbook_chunk_refs, []),
    curriculumUnitId: item.curriculum_unit_id ? String(item.curriculum_unit_id) : null,
    comments: [] as [],
  };
}
