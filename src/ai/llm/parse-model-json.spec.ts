import {
  extractJsonStringFromModelOutput,
  parseJsonFromModelOutput,
} from './parse-model-json';

describe('parseJsonFromModelOutput', () => {
  it('parses fenced JSON', () => {
    expect(
      parseJsonFromModelOutput('```json\n{"ok":true}\n```'),
    ).toEqual({ ok: true });
  });

  it('returns undefined for truncated JSON', () => {
    expect(parseJsonFromModelOutput('{"overallScore": 42')).toBeUndefined();
  });

  it('extracts the first balanced object from prose', () => {
    const extracted = extractJsonStringFromModelOutput(
      'Here is data {"score": 1} trailing',
    );
    expect(JSON.parse(extracted)).toEqual({ score: 1 });
  });
});
