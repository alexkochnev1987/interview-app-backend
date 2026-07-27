import { buildCurrentAnswerMeta } from './take-answer-meta';
import type { Answer } from '../interview/interfaces/interview.interface';

describe('buildCurrentAnswerMeta', () => {
  it('reports stub vs uploaded media and exposes recordingSessionId', () => {
    const stub: Answer = {
      questionIndex: 0,
      questionId: 'q1',
      status: 'recording',
      mediaKey: '',
      uploadedAt: new Date('2026-01-01T00:00:00.000Z'),
      selectedVersionNumber: 1,
      recordingSessionId: 'session-a',
      versions: [
        {
          versionNumber: 1,
          mediaKey: '',
          reservedAt: new Date('2026-01-01T00:00:00.000Z'),
          uploadedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    };

    expect(buildCurrentAnswerMeta(stub)).toEqual({
      status: 'recording',
      versionCount: 1,
      selectedVersionNumber: 1,
      hasMediaOnSelectedVersion: false,
      recordingSessionId: 'session-a',
    });

    const uploaded: Answer = {
      ...stub,
      mediaKey: 'dev/interviews/x/answers/q0-camera-1.webm',
      versions: [
        {
          versionNumber: 1,
          mediaKey: 'dev/interviews/x/answers/q0-camera-1.webm',
          uploadedAt: new Date('2026-01-01T00:00:01.000Z'),
        },
      ],
    };

    expect(buildCurrentAnswerMeta(uploaded).hasMediaOnSelectedVersion).toBe(true);
  });
});
