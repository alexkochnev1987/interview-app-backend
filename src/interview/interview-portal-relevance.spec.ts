import {
  isActiveInterviewStatus,
  sortInterviewsByCandidateRelevance,
} from './interview-portal-relevance';

function item(status: string, updatedAt: string) {
  return { status: status as never, updatedAt: new Date(updatedAt) };
}

describe('isActiveInterviewStatus', () => {
  it('treats pending/in_progress/processing as active', () => {
    expect(isActiveInterviewStatus('pending')).toBe(true);
    expect(isActiveInterviewStatus('in_progress')).toBe(true);
    expect(isActiveInterviewStatus('processing')).toBe(true);
  });

  it('treats completed/failed as not active', () => {
    expect(isActiveInterviewStatus('completed')).toBe(false);
    expect(isActiveInterviewStatus('failed')).toBe(false);
  });
});

describe('sortInterviewsByCandidateRelevance', () => {
  it('puts every active interview before every terminal one', () => {
    const items = [
      item('completed', '2024-01-05'),
      item('pending', '2024-01-01'),
      item('failed', '2024-01-06'),
      item('in_progress', '2024-01-02'),
    ];

    const sorted = sortInterviewsByCandidateRelevance(items);

    // Within each group (active vs. terminal), most-recently-updated wins:
    // in_progress (01-02) outranks pending (01-01); failed (01-06) outranks
    // completed (01-05).
    expect(sorted.map((i) => i.status)).toEqual([
      'in_progress',
      'pending',
      'failed',
      'completed',
    ]);
  });

  it('orders within each group by most recently updated first', () => {
    const items = [
      item('completed', '2024-01-01'),
      item('completed', '2024-01-10'),
      item('completed', '2024-01-05'),
    ];

    const sorted = sortInterviewsByCandidateRelevance(items);

    expect(sorted.map((i) => i.updatedAt.toISOString().slice(0, 10))).toEqual([
      '2024-01-10',
      '2024-01-05',
      '2024-01-01',
    ]);
  });

  it('does not mutate the input array', () => {
    const items = [
      item('completed', '2024-01-01'),
      item('pending', '2024-01-02'),
    ];
    const copy = [...items];
    sortInterviewsByCandidateRelevance(items);
    expect(items).toEqual(copy);
  });
});
