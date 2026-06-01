import { buildQuestionDraftUserPrompt } from './question-draft-llm';

describe('buildQuestionDraftUserPrompt', () => {
  it('requires draft content in the requested locale language', () => {
    const prompt = buildQuestionDraftUserPrompt(
      { questionText: 'Explain React hooks' },
      'pl',
    );

    expect(prompt).toContain('written in Polish');
    expect(prompt).toContain('locale code: pl');
    expect(prompt).toContain('must be "Polish"');
  });

  it('defaults to English instructions for en locale', () => {
    const prompt = buildQuestionDraftUserPrompt(
      { questionText: 'What is a closure?' },
      'en',
    );

    expect(prompt).toContain('written in English');
    expect(prompt).toContain('must be "English"');
  });
});
