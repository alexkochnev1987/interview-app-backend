import type { InterviewListItem } from '../../interview/interfaces/interview.interface';
import {
  formatCandidateInterviewStatusLabel,
  buildCandidateActiveInterviewsResponseText,
  buildCandidateReviewResponseText,
  buildCandidateStatusResponseText,
  buildCandidateUnknownPositionResponseText,
} from './recruiter-assistant-candidate-response-builders';

function listItem(
  overrides: Partial<InterviewListItem> = {},
): InterviewListItem {
  return {
    id: 'id-1',
    candidateName: 'Alice',
    position: 'React Developer',
    status: 'pending',
    questionCount: 3,
    submittedAnswerCount: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

describe('recruiter-assistant-candidate-response-builders', () => {
  it('maps interview statuses to candidate-friendly labels', () => {
    expect(formatCandidateInterviewStatusLabel('pending')).toBe(
      'ready to start',
    );
    expect(formatCandidateInterviewStatusLabel('processing')).toBe(
      'submitted and under review',
    );
    expect(formatCandidateInterviewStatusLabel('completed', true)).toBe(
      'review complete',
    );
    expect(formatCandidateInterviewStatusLabel('completed', false)).toBe(
      'submitted, waiting for feedback',
    );
  });

  it('builds status text for a specific interview', () => {
    expect(buildCandidateStatusResponseText(listItem(), 'ready to start')).toBe(
      'Your interview for React Developer is ready to start.',
    );
  });

  it('builds review text with the position name', () => {
    expect(buildCandidateReviewResponseText(listItem(), true, 'proceed')).toBe(
      'Your React Developer interview has been reviewed (proceed).',
    );
  });

  it('lists active interviews in plain language', () => {
    expect(
      buildCandidateActiveInterviewsResponseText([
        listItem({ position: 'React Developer', status: 'in_progress' }),
        listItem({
          id: 'id-2',
          position: 'Backend Developer',
          status: 'pending',
        }),
      ]),
    ).toBe(
      'You have 2 interviews to complete: React Developer (in progress); Backend Developer (ready to start).',
    );
  });

  it('lists available positions when a position lookup fails', () => {
    expect(
      buildCandidateUnknownPositionResponseText('QA Engineer', [
        listItem({ position: 'React Developer' }),
        listItem({ id: 'id-2', position: 'Backend Developer' }),
      ]),
    ).toBe(
      'I couldn\'t find an interview for "QA Engineer". Your interviews: React Developer, Backend Developer.',
    );
  });
});
