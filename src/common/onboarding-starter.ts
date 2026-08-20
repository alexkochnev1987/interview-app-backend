export const ONBOARDING_STARTER_EMAIL_SUFFIX = '@onboarding-starter.sample';

export function excludeOnboardingStarterClause(
  params: unknown[],
  column = 'candidate_email',
): string {
  params.push(`%${ONBOARDING_STARTER_EMAIL_SUFFIX}`);
  return `(${column} IS NULL OR ${column} NOT LIKE $${params.length})`;
}
