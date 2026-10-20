export type SkillName = 'FOUNDATION' | 'CORE' | 'STRETCH';

const order: SkillName[] = ['FOUNDATION', 'CORE', 'STRETCH'];

export function skillFor(competency: number, streakWrong: number): SkillName {
  let skill: SkillName = competency < 40 ? 'FOUNDATION' : competency < 75 ? 'CORE' : 'STRETCH';
  if (streakWrong >= 2) {
    const index = order.indexOf(skill);
    skill = order[Math.max(0, index - 1)];
  }
  return skill;
}

export function nextCompetency(current: number, correct: boolean, seconds: number) {
  if (correct) {
    const bonus = seconds > 0 && seconds <= 20 ? 4 : 0;
    return Math.min(100, current + 12 + bonus);
  }
  return Math.max(0, current - 15);
}

export function completionPercent(correctIds: string[], poolSize: number) {
  if (poolSize <= 0) return 0;
  return Math.min(100, Math.round((correctIds.length / poolSize) * 100));
}

export function stepSkill(skill: SkillName, direction: 1 | -1): SkillName {
  const index = order.indexOf(skill) + direction;
  return order[Math.min(order.length - 1, Math.max(0, index))];
}
