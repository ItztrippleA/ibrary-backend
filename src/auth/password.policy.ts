export const PASSWORD_RULES = [
  'At least 8 characters',
  '1 upper case character',
  '1 lower case character',
  '1 special character',
] as const;

export function passwordIssues(password: string): string[] {
  const issues: string[] = [];
  if (password.length < 8) issues.push(PASSWORD_RULES[0]);
  if (!/[A-Z]/.test(password)) issues.push(PASSWORD_RULES[1]);
  if (!/[a-z]/.test(password)) issues.push(PASSWORD_RULES[2]);
  if (!/[^A-Za-z0-9]/.test(password)) issues.push(PASSWORD_RULES[3]);
  return issues;
}
