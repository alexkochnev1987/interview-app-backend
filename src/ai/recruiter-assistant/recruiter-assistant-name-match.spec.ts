import {
  normalizePersonName,
  pickUniqueByPersonName,
  scorePersonNameMatch,
} from './recruiter-assistant-name-match';

describe('normalizePersonName', () => {
  it('trims, lowercases, and collapses whitespace', () => {
    expect(normalizePersonName('  Alice   Smith  ')).toBe('alice smith');
  });
});

describe('scorePersonNameMatch', () => {
  it('returns 100 for exact matches', () => {
    expect(scorePersonNameMatch('Alice Smith', 'alice smith')).toBe(100);
  });

  it('returns 80 when one name is a prefix of the other', () => {
    expect(scorePersonNameMatch('Alice', 'Alice Smith')).toBe(80);
    expect(scorePersonNameMatch('Alice Smith', 'Alice')).toBe(80);
  });

  it('returns 70 when all query tokens appear in the actual name', () => {
    expect(scorePersonNameMatch('Alice Marie Smith', 'Alice Smith')).toBe(70);
  });

  it('returns 60 for substring containment', () => {
    expect(scorePersonNameMatch('Alice Smith', 'Smith')).toBe(70);
  });

  it('returns partial overlap scores for shared tokens', () => {
    expect(scorePersonNameMatch('Alice Johnson', 'Alice Smith')).toBe(50);
  });

  it('returns 0 when names do not match', () => {
    expect(scorePersonNameMatch('Bob Jones', 'Alice Smith')).toBe(0);
    expect(scorePersonNameMatch('', 'Alice')).toBe(0);
  });
});

describe('pickUniqueByPersonName', () => {
  type Person = { id: string; name: string };

  const items: Person[] = [
    { id: '1', name: 'Alice Smith' },
    { id: '2', name: 'Bob Jones' },
  ];

  it('returns null for an empty list', () => {
    expect(
      pickUniqueByPersonName<Person>([], 'Alice', (item) => item.name),
    ).toBeNull();
  });

  it('returns null when the only item does not meet the score floor', () => {
    expect(
      pickUniqueByPersonName([items[0]], 'Bob', (item) => item.name),
    ).toBeNull();
  });

  it('returns a single item when the name matches strongly enough', () => {
    expect(
      pickUniqueByPersonName([items[0]], 'Alice Smith', (item) => item.name),
    ).toEqual(items[0]);
  });

  it('returns the best unique match when scores are clearly separated', () => {
    expect(
      pickUniqueByPersonName(items, 'Alice Smith', (item) => item.name),
    ).toEqual(items[0]);
  });

  it('returns null when multiple items tie for the top score', () => {
    const ambiguous = [
      { id: '1', name: 'Alice Smith' },
      { id: '2', name: 'Alice Johnson' },
    ];

    expect(
      pickUniqueByPersonName(ambiguous, 'Alice', (item) => item.name),
    ).toBeNull();
  });
});
