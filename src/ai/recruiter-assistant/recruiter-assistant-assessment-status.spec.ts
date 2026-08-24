import type { InterviewListItem } from '../../interview/interfaces/interview.interface';
import {
  deriveReviewStatusFromListItem,
  filterAssessmentsByReviewStatus,
  isHrVisibleAssessmentListItem,
  matchesAssessmentQuery,
  selectHrVisibleAssessmentListItems,
} from './recruiter-assistant-assessment-status';

function listItem(
  overrides: Partial<InterviewListItem> = {},
): InterviewListItem {
  return {
    id: 'id-1',
    candidateName: 'Alice',
    position: 'React Developer',
    status: 'completed',
    questionCount: 3,
    submittedAnswerCount: 3,
    overallScore: 80,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

describe('recruiter-assistant-assessment-status', () => {
  it('derives ready from completed interviews with scores', () => {
    expect(deriveReviewStatusFromListItem(listItem())).toBe('ready');
  });

  it('derives ready_to_score when all answers are submitted in progress', () => {
    expect(
      deriveReviewStatusFromListItem(
        listItem({
          status: 'in_progress',
          overallScore: undefined,
        }),
      ),
    ).toBe('ready_to_score');
  });

  it('keeps only HR-visible assessments', () => {
    const visible = selectHrVisibleAssessmentListItems([
      listItem(),
      listItem({ status: 'pending' }),
    ]);
    expect(visible).toHaveLength(1);
    expect(isHrVisibleAssessmentListItem(listItem({ status: 'pending' }))).toBe(
      false,
    );
  });

  it('filters by review status and search query', () => {
    const items = [
      listItem({ candidateName: 'Alice', position: 'React Developer' }),
      listItem({
        id: 'id-2',
        candidateName: 'Bob',
        position: 'Backend Developer',
        overallScore: undefined,
        status: 'processing',
      }),
    ];

    expect(filterAssessmentsByReviewStatus(items, 'ready')).toHaveLength(1);
    expect(matchesAssessmentQuery(items[0], 'react')).toBe(true);
    expect(matchesAssessmentQuery(items[1], 'react')).toBe(false);
  });
});
