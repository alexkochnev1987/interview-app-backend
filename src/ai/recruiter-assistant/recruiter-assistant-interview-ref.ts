import { QueryInterviewsDto } from '../../interview/dto/query-interviews.dto';
import { InterviewService } from '../../interview/interview.service';
import { InterviewActor } from '../../interview/interfaces/interview.interface';
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

  const query: QueryInterviewsDto = { limit: 5 };

  if (ref.candidateName) {
    query.q = ref.candidateName;
  } else if (options?.candidateEmail) {
    query.q = options.candidateEmail.split('@')[0];
  } else {
    return null;
  }

  const { items } = await interviewService.findAllPaginated(query, actor);

  if (items.length !== 1) {
    return null;
  }

  const [item] = items;
  return {
    id: item.id,
    candidateName: item.candidateName,
    position: item.position,
    status: item.status,
  };
}
