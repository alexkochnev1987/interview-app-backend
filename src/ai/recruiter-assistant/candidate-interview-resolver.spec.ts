import type { InterviewListItem } from '../../interview/interfaces/interview.interface';
import {
  filterActiveInterviews,
  resolveByPosition,
  resolveLatestInterview,
} from './candidate-interview-resolver';

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

describe('resolveLatestInterview', () => {
  it('returns not_found when the candidate has no interviews', () => {
    expect(resolveLatestInterview([])).toEqual({ kind: 'not_found' });
  });

  it('prefers active interviews over terminal ones regardless of created_at', () => {
    const interviews = [
      listItem({
        id: 'completed',
        status: 'completed',
        updatedAt: new Date('2026-01-10T00:00:00.000Z'),
      }),
      listItem({
        id: 'pending',
        status: 'pending',
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ];

    const result = resolveLatestInterview(interviews);

    expect(result).toEqual({
      kind: 'found',
      interview: expect.objectContaining({ id: 'pending' }),
    });
  });

  it('picks the most recently updated interview within the same status group', () => {
    const interviews = [
      listItem({
        id: 'older',
        status: 'completed',
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      listItem({
        id: 'newer',
        status: 'completed',
        updatedAt: new Date('2026-01-05T00:00:00.000Z'),
      }),
    ];

    const result = resolveLatestInterview(interviews);

    expect(result).toEqual({
      kind: 'found',
      interview: expect.objectContaining({ id: 'newer' }),
    });
  });
});

describe('resolveByPosition', () => {
  it('falls back to latest when the position query is blank', () => {
    const interviews = [
      listItem({ id: 'a', position: 'Backend Developer' }),
      listItem({ id: 'b', position: 'React Developer' }),
    ];

    expect(resolveByPosition(interviews, '   ')).toEqual(
      resolveLatestInterview(interviews),
    );
  });

  it('returns a single interview when the position matches uniquely', () => {
    const interviews = [
      listItem({ id: 'react', position: 'React Developer' }),
      listItem({ id: 'backend', position: 'Backend Developer' }),
    ];

    expect(resolveByPosition(interviews, 'backend')).toEqual({
      kind: 'found',
      interview: expect.objectContaining({ id: 'backend' }),
    });
  });

  it('returns ambiguous when multiple interviews match the position query', () => {
    const interviews = [
      listItem({ id: 'react', position: 'React Developer' }),
      listItem({ id: 'senior-react', position: 'Senior React Developer' }),
    ];

    const result = resolveByPosition(interviews, 'react');

    expect(result.kind).toBe('ambiguous');
    if (result.kind === 'ambiguous') {
      expect(result.interviews.map((item) => item.id)).toEqual([
        'react',
        'senior-react',
      ]);
    }
  });

  it('returns not_found when no interview matches the position query', () => {
    expect(
      resolveByPosition([listItem({ position: 'React Developer' })], 'qa'),
    ).toEqual({ kind: 'not_found' });
  });

  it('matches position queries case-insensitively', () => {
    expect(
      resolveByPosition(
        [listItem({ id: 'react', position: 'React Developer' })],
        'REACT DEVELOPER',
      ),
    ).toEqual({
      kind: 'found',
      interview: expect.objectContaining({ id: 'react' }),
    });
  });
});

describe('filterActiveInterviews', () => {
  it('keeps only pending, in_progress, and processing interviews', () => {
    const interviews = [
      listItem({ id: 'pending', status: 'pending' }),
      listItem({ id: 'in-progress', status: 'in_progress' }),
      listItem({ id: 'processing', status: 'processing' }),
      listItem({ id: 'completed', status: 'completed' }),
      listItem({ id: 'failed', status: 'failed' }),
    ];

    expect(filterActiveInterviews(interviews).map((item) => item.id)).toEqual([
      'pending',
      'in-progress',
      'processing',
    ]);
  });

  it('orders active interviews by portal relevance', () => {
    const interviews = [
      listItem({
        id: 'pending-old',
        status: 'pending',
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      listItem({
        id: 'in-progress-new',
        status: 'in_progress',
        updatedAt: new Date('2026-01-05T00:00:00.000Z'),
      }),
    ];

    expect(filterActiveInterviews(interviews).map((item) => item.id)).toEqual([
      'in-progress-new',
      'pending-old',
    ]);
  });
});
