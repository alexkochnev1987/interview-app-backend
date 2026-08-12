import { parseTemplateChoice } from './recruiter-assistant-template-choice-parse';

describe('parseTemplateChoice', () => {
  it('recognizes create my own phrasing', () => {
    expect(parseTemplateChoice('create my own')).toEqual({ kind: 'own' });
    expect(parseTemplateChoice('my own')).toEqual({ kind: 'own' });
    expect(parseTemplateChoice('own')).toEqual({ kind: 'own' });
  });

  it('parses numeric template choices', () => {
    expect(parseTemplateChoice('1')).toEqual({ kind: 'index', index: 1 });
    expect(parseTemplateChoice('template 2')).toEqual({
      kind: 'index',
      index: 2,
    });
  });

  it('returns null for invalid input', () => {
    expect(parseTemplateChoice('')).toBeNull();
    expect(parseTemplateChoice('maybe later')).toBeNull();
  });
});
