import { extractCandidateNameFromCreateRequest } from './recruiter-assistant-name-extract';
import { extractPositionFromMessage } from './recruiter-assistant-request-parser';

export function extractCreateInterviewFields(message: string): {
  candidateName?: string;
  position?: string;
} {
  return {
    candidateName: extractCandidateNameFromCreateRequest(message),
    position: extractPositionFromMessage(message),
  };
}
