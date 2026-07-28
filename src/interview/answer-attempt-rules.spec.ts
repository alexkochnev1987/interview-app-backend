import { getAnswerVersionOverwriteBlockReason } from './answer-attempt-rules';

describe('getAnswerVersionOverwriteBlockReason', () => {
  const existing = 'dev/interviews/x/answers/q0-camera-1.webm';

  it('allows the same mediaKey and forbids a different one', () => {
    expect(getAnswerVersionOverwriteBlockReason(existing, existing)).toBeNull();
    expect(
      getAnswerVersionOverwriteBlockReason(
        existing,
        'dev/interviews/x/answers/q0-camera-2.webm',
      ),
    ).toMatch(/already has uploaded media/i);
    expect(getAnswerVersionOverwriteBlockReason(existing)).toMatch(
      /already has uploaded media/i,
    );
  });
});
