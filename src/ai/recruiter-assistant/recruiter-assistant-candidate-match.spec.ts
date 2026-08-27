import { findMatchingCandidates } from './recruiter-assistant-candidate-match';

describe('findMatchingCandidates', () => {
  const candidates = [
    { id: '1', name: 'Alice Johnson', email: 'alice@example.com' },
    { id: '2', name: 'Bob Smith', email: 'bob@example.com' },
    { id: '3', name: 'Alicia Keys', email: 'alicia@example.com' },
  ];

  it('returns candidates above the minimum name score', () => {
    expect(findMatchingCandidates(candidates, 'Alice')).toEqual([
      { id: '1', name: 'Alice Johnson', email: 'alice@example.com' },
    ]);
  });

  it('sorts stronger matches first', () => {
    expect(findMatchingCandidates(candidates, 'Alicia Keys')).toEqual([
      { id: '3', name: 'Alicia Keys', email: 'alicia@example.com' },
    ]);
  });

  it('returns an empty list when nothing matches', () => {
    expect(findMatchingCandidates(candidates, 'Zoe')).toEqual([]);
  });
});
