import { completionPercent, nextCompetency, skillFor } from './scoring';

describe('competency', () => {
  it('steps up on a correct answer and down on a miss', () => {
    expect(nextCompetency(50, true, 12)).toBe(66);
    expect(nextCompetency(50, false, 40)).toBe(35);
    expect(nextCompetency(5, false, 10)).toBe(0);
  });

  it('drops a level after two misses and scores completion from the pool', () => {
    expect(skillFor(80, 0)).toBe('STRETCH');
    expect(skillFor(80, 2)).toBe('CORE');
    expect(skillFor(30, 2)).toBe('FOUNDATION');
    expect(completionPercent(['a', 'b'], 4)).toBe(50);
  });
});
