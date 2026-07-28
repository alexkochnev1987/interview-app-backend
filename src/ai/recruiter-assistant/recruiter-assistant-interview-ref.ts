import { InterviewService } from '../../interview/interview.service';
import { InterviewActor } from '../../interview/interfaces/interview.interface';
import { pickUniqueByPersonName } from './recruiter-assistant-name-match';
import { InterviewRef } from './recruiter-assistant.types';

export async function resolveInterviewRef(
  interviewService: InterviewService,
  ref: InterviewRef,
  actor: InterviewActor,
  options?: { candidateEmail?: string },
): Promise<{
  id: string;
  candidateName: string;
  position: string;
  status: string;
} | null> {
  if (ref.interviewId) {
    try {
      const interview = await interviewService.findOneForActor(
        ref.interviewId,
        actor,
      );
      return {
        id: interview.id,
        candidateName: interview.candidateName,
        position: interview.position,
        status: interview.status,
      };
    } catch {
      return null;
    }
  }

  const searchTerm = ref.candidateName ?? options?.candidateEmail?.split('@')[0];
  if (!searchTerm) {
    return null;
  }

  const { items } = await interviewService.findAllPaginated(
    { q: searchTerm, limit: 20 },
    actor,
  );

  const item = pickUniqueByPersonName(
    items,
    searchTerm,
    (entry) => entry.candidateName,
  );
  if (!item) {
    return null;
  }

  return {
    id: item.id,
    candidateName: item.candidateName,
    position: item.position,
    status: item.status,
  };
}
