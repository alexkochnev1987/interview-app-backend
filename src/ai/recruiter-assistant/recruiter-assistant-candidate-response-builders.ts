import {
  InterviewListItem,
  InterviewStatus,
} from '../../interview/interfaces/interview.interface';
import {
  RecruiterAssistantInterviewSummaryDto,
  RecruiterAssistantRedirectDto,
} from './dto/recruiter-assistant.dto';

export function formatCandidateInterviewStatusLabel(
  status: InterviewStatus,
  resultsReady?: boolean,
): string {
  switch (status) {
    case 'pending':
      return 'ready to start';
    case 'in_progress':
      return 'in progress';
    case 'processing':
      return 'submitted and under review';
    case 'completed':
      return resultsReady
        ? 'review complete'
        : 'submitted, waiting for feedback';
    case 'failed':
      return 'failed';
    default: {
      const unexpectedStatus: never = status;
      throw new Error(
        `Unhandled interview status: ${String(unexpectedStatus)}`,
      );
    }
  }
}

export function buildCandidatePortalRedirect(): RecruiterAssistantRedirectDto {
  return { path: '/portal' };
}

export function buildCandidatePortalInterviewRedirect(
  interviewId: string,
): RecruiterAssistantRedirectDto {
  return { path: `/portal/interviews/${interviewId}` };
}

export function buildCandidateContinueUrl(
  interviewId: string,
  token: string,
): string {
  return `/take/${interviewId}?token=${token}&from=portal`;
}

export function buildCandidateInterviewSummary(
  interview: InterviewListItem,
  input: {
    continueUrl?: string;
    reviewState?: RecruiterAssistantInterviewSummaryDto['reviewState'];
  } = {},
): RecruiterAssistantInterviewSummaryDto {
  return {
    id: interview.id,
    candidateName: interview.candidateName,
    position: interview.position,
    status: interview.status,
    candidateLink: input.continueUrl,
    reviewState: input.reviewState,
  };
}

export function buildCandidateStatusResponseText(
  interview: InterviewListItem,
  statusLabel: string,
  scheduleInquiry?: boolean,
): string {
  if (scheduleInquiry) {
    return (
      `Your interview for ${interview.position} is ${statusLabel}. ` +
      `It was created on ${interview.createdAt.toISOString().slice(0, 10)}. ` +
      'This app does not store a separate interview time or location yet — ' +
      'use your interview link when the status is pending or in progress.'
    );
  }

  return `Your interview for ${interview.position} is ${statusLabel}.`;
}

export function buildCandidateReviewResponseText(
  interview: InterviewListItem,
  reviewed: boolean,
  outcome?: string,
): string {
  const positionLabel = interview.position;
  if (reviewed) {
    return `Your ${positionLabel} interview has been reviewed${outcome ? ` (${outcome})` : ''}.`;
  }
  if (interview.status === 'completed' || interview.status === 'processing') {
    return `Your ${positionLabel} interview has been submitted but has not been reviewed yet.`;
  }
  return `Your ${positionLabel} interview has not been reviewed yet.`;
}

export function buildCandidateAmbiguousPositionResponseText(
  interviews: InterviewListItem[],
): string {
  const options = interviews
    .map(
      (item) =>
        `${item.position} (${formatCandidateInterviewStatusLabel(item.status)})`,
    )
    .join('; ');
  return `I found multiple interviews matching that position: ${options}. Please specify the exact role name.`;
}

export function buildCandidateUnknownPositionResponseText(
  positionQuery: string,
  interviews: InterviewListItem[],
): string {
  const available = [...new Set(interviews.map((item) => item.position))].join(
    ', ',
  );
  return `I couldn't find an interview for "${positionQuery}". Your interviews: ${available}.`;
}

export function buildCandidateNoInterviewsResponseText(): string {
  return 'You do not have any interviews yet.';
}

export function buildCandidateActiveInterviewsResponseText(
  interviews: InterviewListItem[],
): string {
  if (interviews.length === 0) {
    return 'You have no interviews waiting to be completed.';
  }

  const describe = (item: InterviewListItem): string =>
    `${item.position} (${formatCandidateInterviewStatusLabel(item.status)})`;

  if (interviews.length === 1) {
    return `You have 1 interview to complete: ${describe(interviews[0])}.`;
  }

  return `You have ${interviews.length} interviews to complete: ${interviews.map(describe).join('; ')}.`;
}

export function buildCandidateAllInterviewsResponseText(
  interviews: InterviewListItem[],
): string {
  if (interviews.length === 0) {
    return buildCandidateNoInterviewsResponseText();
  }

  const summary = interviews
    .map(
      (item) =>
        `${item.position} (${formatCandidateInterviewStatusLabel(item.status)})`,
    )
    .join('; ');
  return `You have ${interviews.length} interview(s): ${summary}.`;
}
