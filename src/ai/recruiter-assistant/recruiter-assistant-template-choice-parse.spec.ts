import { parseTemplateChoice } from './recruiter-assistant-template-choice-parse';

describe('parseTemplateChoice', () => {
  it('recognizes create my own phrasing in English', () => {
    expect(parseTemplateChoice('create my own')).toEqual({ kind: 'own' });
    expect(parseTemplateChoice('my own')).toEqual({ kind: 'own' });
    expect(parseTemplateChoice('own')).toEqual({ kind: 'own' });
  });

  it('recognizes create-own phrasing in Russian, Belarusian, and Polish', () => {
    expect(parseTemplateChoice('создать свой')).toEqual({ kind: 'own' });
    expect(parseTemplateChoice('свой')).toEqual({ kind: 'own' });
    expect(parseTemplateChoice('стварыць свой')).toEqual({ kind: 'own' });
    expect(parseTemplateChoice('utwórz własny')).toEqual({ kind: 'own' });
    expect(parseTemplateChoice('mój własny')).toEqual({ kind: 'own' });
  });

  it('parses numeric template choices', () => {
    expect(parseTemplateChoice('1')).toEqual({ kind: 'index', index: 1 });
    expect(parseTemplateChoice('template 2')).toEqual({
      kind: 'index',
      index: 2,
    });
    expect(parseTemplateChoice('шаблон 3')).toEqual({
      kind: 'index',
      index: 3,
    });
    expect(parseTemplateChoice('szablon 4')).toEqual({
      kind: 'index',
      index: 4,
    });
  });

  it('returns null for invalid input', () => {
    expect(parseTemplateChoice('')).toBeNull();
    expect(parseTemplateChoice('maybe later')).toBeNull();
  });
});
