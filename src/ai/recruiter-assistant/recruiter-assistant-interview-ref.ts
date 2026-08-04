import { InterviewService } from '../../interview/interview.service';
import { Interview, InterviewActor } from '../../interview/interfaces/interview.interface';
import { pickUniqueByPersonName } from './recruiter-assistant-name-match';
import { InterviewRef } from './recruiter-assistant.types';

export async function resolveInterviewRef(
  interviewService: InterviewService,
  ref: InterviewRef,
  actor: InterviewActor,
  options?: { candidateEmail?: string },
): Promise<Interview | null> {
  if (ref.interviewId) {
    try {
      return await interviewService.findOneForActor(ref.interviewId, actor);
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

  try {
    return await interviewService.findOneForActor(item.id, actor);
  } catch {
    return null;
  }
}
