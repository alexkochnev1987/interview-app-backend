export const CANDIDATE_TOKEN_MISMATCH_MESSAGE =
  'Token does not match interview';

export function getCandidateTokenMismatchReason(
  routeInterviewId: string,
  tokenInterviewId: string,
): string | null {
  if (routeInterviewId === tokenInterviewId) {
    return null;
  }
  return CANDIDATE_TOKEN_MISMATCH_MESSAGE;
}
