import { hidesAnswer, writeLessonScript } from './lesson';

describe('lesson script', () => {
  const brief = {
    title: 'Osmosis',
    subject: 'Biology, SS1 term 1',
    summary: 'Water crosses a membrane toward the side with less free water.',
    objectives: ['Explain osmosis with a kitchen example.'],
    glossary: [{ term: 'Membrane', meaning: 'A thin skin that lets some things through.' }],
    focus: 'how osmosis applies to soaking garri',
  };

  it('keeps two speakers and the student focus', () => {
    const turns = writeLessonScript(brief);
    expect(turns.length).toBeGreaterThanOrEqual(8);
    expect(turns.some((turn) => turn.speaker === 'guide')).toBe(true);
    expect(turns.some((turn) => turn.speaker === 'student')).toBe(true);
    expect(turns.map((turn) => turn.text).join(' ')).toContain('soaking garri');
    expect(turns.map((turn) => turn.text).join(' ')).toContain('garri sitting in a bowl of water');
  });

  it('hides a full answer and a short option', () => {
    expect(hidesAnswer('Think about the grains.', 'Osmosis')).toBe(true);
    expect(hidesAnswer('The answer is Osmosis.', 'Osmosis')).toBe(false);
    expect(hidesAnswer('Pick 7 if you must.', '7')).toBe(false);
    expect(hidesAnswer('Count the power of x.', '7')).toBe(true);
  });
});
