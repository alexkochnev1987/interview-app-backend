import {
  extractJsonStringFromModelOutput,
  parseJsonFromModelOutput,
} from './parse-model-json';

describe('parse-model-json', () => {
  it('strips fences and parses JSON payloads', () => {
    expect(extractJsonStringFromModelOutput('  {"a":1}  ')).toBe('{"a":1}');
    expect(
      extractJsonStringFromModelOutput('```json\n{"ok":true}\n```'),
    ).toBe('{"ok":true}');
    expect(parseJsonFromModelOutput('{"x":42}')).toEqual({ x: 42 });
    expect(
      parseJsonFromModelOutput('```json\n{"nested":{"y":1}}\n```'),
    ).toEqual({ nested: { y: 1 } });
  });
});
