import {
  buildInterviewHref,
  buildScheduledDeleteReason,
  collectPendingDeletionAttachRejectIds,
  mapBlockingInterviews,
} from './question-scheduled-deletion.helpers';

describe('question-scheduled-deletion.helpers', () => {
  it('builds staff interview hrefs', () => {
    expect(buildInterviewHref('abc-123')).toBe('/interviews/abc-123');
  });

  it('maps blocking interview rows to API shape', () => {
    expect(
      mapBlockingInterviews([
        { id: 'i-1', candidate_name: 'Alice' },
        { id: 'i-2', candidate_name: 'Bob' },
      ]),
    ).toEqual([
      { id: 'i-1', candidateName: 'Alice', href: '/interviews/i-1' },
      { id: 'i-2', candidateName: 'Bob', href: '/interviews/i-2' },
    ]);
  });

  it('uses the default scheduled-delete reason when no interviews block', () => {
    expect(buildScheduledDeleteReason([])).toBe(
      'Question is scheduled for deletion when related active interviews finish.',
    );
  });

  it('lists blocking interview links in the scheduled-delete reason', () => {
    expect(
      buildScheduledDeleteReason([
        { id: 'i-1', candidateName: 'Alice', href: '/interviews/i-1' },
      ]),
    ).toBe(
      'Question is scheduled for deletion when these active interviews finish: /interviews/i-1',
    );
  });

  it('collects ids scheduled for deletion from an attach candidate set', () => {
    const pending = new Set(['q-2', 'q-4']);
    expect(
      collectPendingDeletionAttachRejectIds(
        ['q-1', 'q-2', 'q-3'],
        (id) => pending.has(id),
      ),
    ).toEqual(['q-2']);
  });

  it('returns no attach reject ids when none of the candidates are pending deletion', () => {
    expect(
      collectPendingDeletionAttachRejectIds(['q-1', 'q-2'], () => false),
    ).toEqual([]);
  });

  it('returns no attach reject ids when the candidate set is empty', () => {
    expect(
      collectPendingDeletionAttachRejectIds([], () => true),
    ).toEqual([]);
  });

  it('rejects every candidate id when all are pending deletion', () => {
    expect(
      collectPendingDeletionAttachRejectIds(['q-1', 'q-2'], () => true),
    ).toEqual(['q-1', 'q-2']);
  });
});
