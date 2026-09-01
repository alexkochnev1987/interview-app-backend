import {
  InterviewListItem,
  InterviewStatus,
} from '../../interview/interfaces/interview.interface';
import { Locale } from '../../locale/locale.constants';
import {
  RecruiterAssistantInterviewSummaryDto,
  RecruiterAssistantRedirectDto,
} from './dto/recruiter-assistant.dto';
import { assistantMessage as msg } from './recruiter-assistant-i18n';

export function formatCandidateInterviewStatusLabel(
  messageLocale: Locale,
  status: InterviewStatus,
  resultsReady?: boolean,
): string {
  switch (status) {
    case 'pending':
      return msg(messageLocale, 'candidate.status.readyToStart');
    case 'in_progress':
      return msg(messageLocale, 'candidate.status.inProgress');
    case 'processing':
      return msg(messageLocale, 'candidate.status.submittedReview');
    case 'completed':
      return resultsReady
        ? msg(messageLocale, 'candidate.status.reviewComplete')
        : msg(messageLocale, 'candidate.status.submittedWaiting');
    case 'failed':
      return msg(messageLocale, 'candidate.status.failed');
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
  messageLocale: Locale,
  interview: InterviewListItem,
  statusLabel: string,
  scheduleInquiry?: boolean,
): string {
  if (scheduleInquiry) {
    return msg(messageLocale, 'candidate.statusResponseSchedule', {
      position: interview.position,
      statusLabel,
      createdDate: interview.createdAt.toISOString().slice(0, 10),
    });
  }

  return msg(messageLocale, 'candidate.statusResponse', {
    position: interview.position,
    statusLabel,
  });
}

export function buildCandidateReviewResponseText(
  messageLocale: Locale,
  interview: InterviewListItem,
  reviewed: boolean,
  outcome?: string,
): string {
  const position = interview.position;
  const outcomeSuffix = outcome ? ` (${outcome})` : '';

  if (reviewed) {
    return msg(messageLocale, 'candidate.reviewed', {
      position,
      outcome: outcomeSuffix,
    });
  }
  if (interview.status === 'completed' || interview.status === 'processing') {
    return msg(messageLocale, 'candidate.submittedNotReviewed', { position });
  }
  return msg(messageLocale, 'candidate.notReviewed', { position });
}

export function buildCandidateAmbiguousPositionResponseText(
  messageLocale: Locale,
  interviews: InterviewListItem[],
): string {
  const options = interviews
    .map(
      (item) =>
        `${item.position} (${formatCandidateInterviewStatusLabel(messageLocale, item.status)})`,
    )
    .join('; ');
  return msg(messageLocale, 'candidate.ambiguousPosition', { options });
}

export function buildCandidateUnknownPositionResponseText(
  messageLocale: Locale,
  positionQuery: string,
  interviews: InterviewListItem[],
): string {
  const available = [...new Set(interviews.map((item) => item.position))].join(
    ', ',
  );
  return msg(messageLocale, 'candidate.unknownPosition', {
    query: positionQuery,
    available,
  });
}

export function buildCandidateNoInterviewsResponseText(
  messageLocale: Locale,
): string {
  return msg(messageLocale, 'candidate.noInterviews');
}

export function buildCandidateActiveInterviewsResponseText(
  messageLocale: Locale,
  interviews: InterviewListItem[],
): string {
  if (interviews.length === 0) {
    return msg(messageLocale, 'candidate.noActiveInterviews');
  }

  const describe = (item: InterviewListItem): string =>
    `${item.position} (${formatCandidateInterviewStatusLabel(messageLocale, item.status)})`;

  if (interviews.length === 1) {
    return msg(messageLocale, 'candidate.oneActiveInterview', {
      description: describe(interviews[0]),
    });
  }

  return msg(messageLocale, 'candidate.multipleActiveInterviews', {
    count: interviews.length,
    descriptions: interviews.map(describe).join('; '),
  });
}

export function buildCandidateAllInterviewsResponseText(
  messageLocale: Locale,
  interviews: InterviewListItem[],
): string {
  if (interviews.length === 0) {
    return buildCandidateNoInterviewsResponseText(messageLocale);
  }

  const summary = interviews
    .map(
      (item) =>
        `${item.position} (${formatCandidateInterviewStatusLabel(messageLocale, item.status)})`,
    )
    .join('; ');
  return msg(messageLocale, 'candidate.allInterviews', {
    count: interviews.length,
    summary,
  });
}
