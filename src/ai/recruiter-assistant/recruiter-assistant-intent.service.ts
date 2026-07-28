import { Injectable } from '@nestjs/common';
import { Locale } from '../../locale/locale.constants';
import { QueryInterviewsDto } from '../../interview/dto/query-interviews.dto';
import { INTERVIEW_STATUSES } from '../../interview/interfaces/interview.interface';
import { parseRecruiterRequest } from './recruiter-assistant-request-parser';
import {
  ActingUser,
  HrRef,
  InterviewRef,
  RecruiterAssistantIntent,
} from './recruiter-assistant.types';

const CREATE_INTENT_KEYWORDS = [
  'question',
  'prepare',
  'create interview',
  'create an interview',
  'вопрос',
  'создай',
  'создать',
  'интерв',
  'разработчик',
  'developer',
];

@Injectable()
export class RecruiterAssistantIntentService {
  classify(
    message: string,
    user: ActingUser,
    locale: Locale,
  ): RecruiterAssistantIntent {
    const normalized = message.toLowerCase().trim();

    if (this.matchesAssignHr(normalized)) {
      return {
        kind: 'assign_hr',
        interviewRef: this.extractInterviewRef(message),
        hrRef: this.extractHrRef(message),
      };
    }

    if (/\bunassigned\b/.test(normalized)) {
      return { kind: 'list_unassigned' };
    }

    if (/ready for (my )?review/.test(normalized)) {
      return {
        kind: 'list_interviews',
        filters: { status: 'completed', limit: 20 },
        readyForReview: true,
      };
    }

    if (
      /\b(my interviews|show my interviews|list my interviews)\b/.test(normalized)
    ) {
      return { kind: 'list_interviews', filters: { limit: 20 } };
    }

    if (
      user.role === 'candidate'
      && /\b(do i have an interview|have i got an interview)\b/.test(normalized)
    ) {
      return { kind: 'interview_status', ref: {}, ownInterviews: true };
    }

    if (/\b(reviewed|been reviewed|review state)\b/.test(normalized)) {
      return {
        kind: 'review_state',
        ref: this.extractInterviewRef(message),
      };
    }

    if (
      /\b(status of|status for|what is the status|what's the status)\b/.test(
        normalized,
      )
    ) {
      return {
        kind: 'interview_status',
        ref: this.extractInterviewRef(message),
      };
    }

    if (
      /\b(show interviews|list interviews|interviews by)\b/.test(normalized)
    ) {
      return {
        kind: 'list_interviews',
        filters: this.extractListFilters(normalized),
      };
    }

    if (this.matchesCreateIntent(normalized)) {
      return {
        kind: 'create_questions_interview',
        parsed: parseRecruiterRequest(message, locale),
      };
    }

    return { kind: 'out_of_scope' };
  }

  private matchesAssignHr(normalized: string): boolean {
    return (
      /\bassign\b/.test(normalized)
      && (/\bhr\b/.test(normalized) || /\bto\b/.test(normalized))
    );
  }

  private matchesCreateIntent(normalized: string): boolean {
    return CREATE_INTENT_KEYWORDS.some((keyword) =>
      normalized.includes(keyword),
    );
  }

  private extractInterviewRef(message: string): InterviewRef {
    const uuidMatch = message.match(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
    );
    if (uuidMatch) {
      return { interviewId: uuidMatch[0] };
    }

    const nameMatch = message.match(
      /(?:interview (?:for|of)|candidate)\s+([A-ZА-ЯЁ][\p{L}'-]+(?:\s+[A-ZА-ЯЁ][\p{L}'-]+){0,2})/u,
    );
    if (nameMatch?.[1]) {
      return { candidateName: nameMatch[1].trim() };
    }

    return {};
  }

  private extractHrRef(message: string): HrRef {
    const uuidMatch = message.match(
      /hr\s+([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i,
    );
    if (uuidMatch) {
      return { id: uuidMatch[1] };
    }

    const nameMatch = message.match(
      /\b(?:to|hr)\s+([A-ZА-ЯЁ][\p{L}'-]+(?:\s+[A-ZА-ЯЁ][\p{L}'-]+){0,2})/u,
    );
    if (nameMatch?.[1]) {
      return { name: nameMatch[1].trim() };
    }

    return {};
  }

  private extractListFilters(normalized: string): QueryInterviewsDto {
    const filters: QueryInterviewsDto = { limit: 20 };

    for (const status of INTERVIEW_STATUSES) {
      if (normalized.includes(status.replace('_', ' ')) || normalized.includes(status)) {
        filters.status = status;
        break;
      }
    }

    return filters;
  }
}
