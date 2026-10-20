import { createHash } from 'crypto';

export type Gloss = { term: string; meaning: string };
export type Turn = { speaker: 'guide' | 'student'; text: string };

export type LessonBrief = {
  title: string;
  subject: string;
  summary: string;
  objectives: string[];
  glossary: Gloss[];
  focus: string;
  body?: string;
};

const pictures = [
  {
    scene: 'garri sitting in a bowl of water',
    point: 'The water keeps moving until the grains and the bowl feel even',
  },
  {
    scene: 'a danfo filling up at the motor park',
    point: 'People board until the queue and the bus are no longer out of balance',
  },
  {
    scene: 'palm oil resting on a pot of stew',
    point: 'What mixes and what stays apart depends on the barrier between them',
  },
  {
    scene: 'NEPA bringing light back to a street',
    point: 'The change shows up where the path was blocked, not everywhere at once',
  },
];

function pictureFor(text: string) {
  const hay = text.toLowerCase();
  if (/garri|osmos|soak|membrane|water/.test(hay)) return pictures[0];
  if (/oil|stew|mix|barrier/.test(hay)) return pictures[2];
  if (/light|electric|current|circuit/.test(hay)) return pictures[3];
  if (/bus|queue|people|balance/.test(hay)) return pictures[1];
  return pictures[text.length % pictures.length];
}

export function focusHash(focus: string) {
  const clean = focus.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!clean) return 'overview';
  return createHash('sha256').update(clean).digest('hex').slice(0, 16);
}

export function normalFocus(focus: string) {
  return focus.trim().replace(/\s+/g, ' ').slice(0, 280);
}

export function readGlossary(value: unknown): Gloss[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as { term?: unknown; meaning?: unknown };
    if (typeof row.term !== 'string' || typeof row.meaning !== 'string') return [];
    return [{ term: row.term, meaning: row.meaning }];
  });
}

export function readTurns(value: unknown): Turn[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as { speaker?: unknown; text?: unknown };
    if ((row.speaker !== 'guide' && row.speaker !== 'student') || typeof row.text !== 'string') {
      return [];
    }
    return [{ speaker: row.speaker, text: row.text }];
  });
}

export function writeLessonScript(brief: LessonBrief): Turn[] {
  const picture = pictureFor(`${brief.title} ${brief.focus} ${brief.summary}`);
  const aim = brief.objectives[0] ?? `Keep the idea of ${brief.title} steady.`;
  const word = brief.glossary[0];
  const focus = brief.focus.trim();
  const detail = (brief.body || brief.summary).replace(/\s+/g, ' ').trim();

  const turns: Turn[] = [
    {
      speaker: 'guide',
      text: `Welcome in. Today we are sitting with ${brief.title}, from ${brief.subject}. I will not read the page at you. We will walk through one picture until it holds.`,
    },
    {
      speaker: 'student',
      text: focus
        ? `Can we stay on this: ${focus}? That is the part I want the two of us to unpack.`
        : `Can we take the whole idea, not just the definition? I want to know what I should picture first.`,
    },
    {
      speaker: 'guide',
      text: `Start here. Picture ${picture.scene}. ${picture.point}. That is the shape of ${brief.title}: something moves, or balances, because a condition changed.`,
    },
    {
      speaker: 'student',
      text: focus
        ? `If I hold “${focus}” next to ${picture.scene}, the lesson stops feeling like a paragraph and starts feeling like something I have seen.`
        : `So I should not memorise the line. I should ask what is moving, and what is being held back.`,
    },
    {
      speaker: 'guide',
      text: `Yes. The aim for this topic is: ${aim} The short version from the lesson is this: ${detail}`,
    },
    {
      speaker: 'student',
      text: word
        ? `The word I keep meeting is “${word.term}”. Say what it is doing in that picture, not the dictionary line.`
        : `Give me one check I can use in class, without handing me the answer.`,
    },
    {
      speaker: 'guide',
      text: word
        ? `${word.term} means ${word.meaning} In the picture, look for that job. If you can point to it, you have the idea.`
        : `Pause and ask: what changed, what moved, and what stayed the same? Answer that in your own words before you pick an option.`,
    },
    {
      speaker: 'student',
      text: `I will retell it as ${picture.scene}, then check it against ${brief.title}. If my story and the lesson disagree, I go back to the picture instead of guessing.`,
    },
    {
      speaker: 'guide',
      text: `That is the work. When a question comes, start from the picture, name the part you are sure of, and only then choose. We can listen to this again at a slower pace.`,
    },
  ];

  return turns;
}

export function hidesAnswer(message: string, answer: string) {
  const folded = message.toLowerCase().replace(/\s+/g, ' ');
  const needle = answer.toLowerCase().replace(/\s+/g, ' ').trim();
  if (needle.length < 4) {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return !new RegExp(`(?:^|\\s)${escaped}(?:$|[\\s.,])`).test(folded);
  }
  return !folded.includes(needle);
}
