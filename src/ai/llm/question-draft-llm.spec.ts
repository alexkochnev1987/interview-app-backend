import { buildQuestionDraftUserPrompt } from './question-draft-llm';

describe('buildQuestionDraftUserPrompt', () => {
  it('requires draft rubric content in the requested locale language', () => {
    const prompt = buildQuestionDraftUserPrompt(
      { questionText: 'Explain React hooks' },
      'pl',
    );

    expect(prompt).toContain('Output locale: pl (Polish)');
    expect(prompt).toContain('Write ALL human-readable rubric text in Polish');
    expect(prompt).toContain('snake_case Latin');
    expect(prompt).toContain('match the rubric language to the requested locale (pl)');
    expect(prompt).toContain('Do not use English boilerplate templates');
    expect(prompt).toContain('label and description in Polish');
  });

  it('omits English-boilerplate warning for en locale', () => {
    const prompt = buildQuestionDraftUserPrompt(
      { questionText: 'What is a closure?' },
      'en',
    );

    expect(prompt).toContain('Output locale: en (English)');
    expect(prompt).not.toContain('Do not use English boilerplate templates');
    expect(prompt).toContain('label and description in English');
  });

  it('adds strict locale mode in prompt when requested', () => {
    const prompt = buildQuestionDraftUserPrompt(
      { questionText: 'замыкание' },
      'ru',
      { strictLocale: true },
    );

    expect(prompt).toContain('STRICT LOCALE MODE');
    expect(prompt).toContain('Russian (ru)');
  });
});
