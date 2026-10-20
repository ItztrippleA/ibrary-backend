import { passwordIssues } from './password.policy';

describe('passwordIssues', () => {
  it('accepts a password that meets every rule from the design', () => {
    expect(passwordIssues('Kennet1!')).toEqual([]);
  });

  it('lists each missing rule', () => {
    expect(passwordIssues('kennet')).toEqual([
      'At least 8 characters',
      '1 upper case character',
      '1 special character',
    ]);
  });
});
