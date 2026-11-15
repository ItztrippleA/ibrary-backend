import { toApiClassName, toDisplayClassName } from './class-names';

describe('class names', () => {
  it('maps app labels to content API class names', () => {
    expect(toApiClassName('SS1')).toBe('SSS 1');
    expect(toApiClassName('ss2')).toBe('SSS 2');
    expect(toApiClassName('SSS 3')).toBe('SSS 3');
    expect(toApiClassName('sss1')).toBe('SSS 1');
  });

  it('maps content API class names back to app labels', () => {
    expect(toDisplayClassName('SSS 1')).toBe('SS1');
    expect(toDisplayClassName('SS2')).toBe('SS2');
  });
});
