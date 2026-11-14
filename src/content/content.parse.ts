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
  if (!Array.isArray(parsed)) return [];
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

export function contentIndexFromSk(sk: string): number {
  const match = /CONTENT#(\d+)$/.exec(sk);
  return match ? Number(match[1]) : 0;
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
  const title = String(item.topic || item.title || 'Topic');
  return {
    topicNumber: Number(item.topic_number),
    title,
    description: objectives[0] ?? '',
    objectives,
    glossary: parseGlossary(item.glossary_terms),
  };
}

export function presentSummary(item: Record<string, unknown>) {
  return {
    contentIndex: contentIndexFromSk(String(item.SK ?? '')),
    title: String(item.subtopic ?? 'Lesson'),
  };
}

export function presentLesson(item: Record<string, unknown>, contentIndex: number) {
  return {
    contentIndex,
    title: String(item.subtopic ?? 'Lesson'),
    contentMarkdown: String(item.curated_content_md ?? ''),
    keyTakeaways: parseStringList(item.key_takeaways),
    glossary: parseGlossary(item.glossary_terms),
    activities: parseStringList(item.student_activities),
    teacherActivities: parseStringList(item.teacher_activities),
    accessibilityContext: presentChecklist(item.accessibility_checklist),
    textbookRefs: parseJsonField<unknown[]>(item.textbook_chunk_refs, []),
    curriculumUnitId: item.curriculum_unit_id ? String(item.curriculum_unit_id) : null,
    comments: [] as [],
  };
}
