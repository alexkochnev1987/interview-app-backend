import { CandidateSummary } from '../../user/user.service';
import { scorePersonNameMatch } from './recruiter-assistant-name-match';

export const CANDIDATE_NAME_MATCH_MIN_SCORE = 60;

export function findMatchingCandidates(
  candidates: CandidateSummary[],
  name: string,
  minimumScore = CANDIDATE_NAME_MATCH_MIN_SCORE,
): CandidateSummary[] {
  return candidates
    .map((candidate) => ({
      candidate,
      score: scorePersonNameMatch(candidate.name, name),
    }))
    .filter((entry) => entry.score >= minimumScore)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.candidate);
}
