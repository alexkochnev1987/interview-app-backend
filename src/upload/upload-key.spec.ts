import {
  buildInterviewMediaKey,
  matchesInterviewMediaKey,
} from './upload-key';

describe('upload-key', () => {
  const base = {
    prefix: 'media',
    interviewId: 'int-1',
    questionIndex: 2,
    mediaType: 'camera' as const,
    timestamp: 1_700_000_000_000,
  };

  it('builds and matches interview media keys', () => {
    const key = buildInterviewMediaKey(base);
    expect(key).toBe(
      'media/interviews/int-1/answers/q2-camera-1700000000000.webm',
    );
    expect(
      matchesInterviewMediaKey({
        mediaKey: key,
        interviewId: 'int-1',
        questionIndex: 2,
        mediaType: 'camera',
      }),
    ).toBe(true);
    expect(
      matchesInterviewMediaKey({
        mediaKey: key,
        interviewId: 'other',
        questionIndex: 2,
      }),
    ).toBe(false);
  });
});
