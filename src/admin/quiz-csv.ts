import { ClassLevel } from '@prisma/client';

const REQUIRED = [
  'topic_id',
  'title',
  'question',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct_answer',
] as const;

const ANSWERS: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

export type ParsedQuestion = {
  prompt: string;
  options: string[];
  correctIndex: number;
  year: number | null;
};

export type ParsedQuiz = {
  slug: string;
  title: string;
  theme: string;
  classLevel: ClassLevel | null;
  questions: ParsedQuestion[];
};

export type SkippedRow = { row: number; reason: string };

export function classFromToken(value: string): ClassLevel | null {
  const match = value.toLowerCase().match(/(jss|sss|ss)([1-3])/);
  if (!match) return null;
  const level = `${match[1] === 'jss' ? 'JSS' : 'SS'}${match[2]}`;
  return (Object.values(ClassLevel) as string[]).includes(level) ? (level as ClassLevel) : null;
}

export function parseQuizCsv(csv: string): { quizzes: ParsedQuiz[]; skipped: SkippedRow[] } {
  const table = parseCsv(csv);
  if (!table.length) throw new Error('The file is empty.');

  const header = table[0].map((cell) => cell.trim().toLowerCase());
  const missing = REQUIRED.filter((column) => !header.includes(column));
  if (missing.length) {
    throw new Error(`Missing columns: ${missing.join(', ')}.`);
  }

  const index = new Map(header.map((name, position) => [name, position]));
  const cell = (row: string[], name: string) => (row[index.get(name) ?? -1] ?? '').trim();
  const groups = new Map<string, ParsedQuiz>();
  const skipped: SkippedRow[] = [];

  table.slice(1).forEach((row, offset) => {
    const line = offset + 2;
    const topicId = cell(row, 'topic_id');
    const title = cell(row, 'title');
    const prompt = cell(row, 'question');
    const options = ['option_a', 'option_b', 'option_c', 'option_d'].map((name) => cell(row, name));
    const answer = cell(row, 'correct_answer').toUpperCase();
    const yearText = cell(row, 'waec_year');
    const year = /^\d{4}$/.test(yearText) ? Number(yearText) : null;

    if (!topicId || !title || !prompt) {
      skipped.push({ row: line, reason: 'Topic, title, or question is empty.' });
      return;
    }
    if (options.some((option) => !option)) {
      skipped.push({ row: line, reason: 'Each question needs options A to D.' });
      return;
    }
    if (!(answer in ANSWERS)) {
      skipped.push({ row: line, reason: 'Correct answer must be A, B, C, or D.' });
      return;
    }

    const slug = topicId
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
    if (!slug) {
      skipped.push({ row: line, reason: 'Topic id cannot be used as a quiz id.' });
      return;
    }

    const quiz = groups.get(slug) ?? {
      slug,
      title,
      theme: cell(row, 'theme'),
      classLevel: classFromToken(topicId) ?? classFromToken(cell(row, 'question_id')),
      questions: [],
    };
    quiz.questions.push({ prompt, options, correctIndex: ANSWERS[answer], year });
    groups.set(slug, quiz);
  });

  return { quizzes: [...groups.values()].filter((quiz) => quiz.questions.length), skipped };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          value += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        value += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(value);
      value = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(value);
      value = '';
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
    } else {
      value += char;
    }
  }

  if (value.length || row.length) {
    row.push(value);
    if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  }
  return rows;
}
