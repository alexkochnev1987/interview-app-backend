import { getAnswerVersionOverwriteBlockReason } from './answer-attempt-rules';
import { resolveVersionMediaKeyForArtifact } from '../upload/upload-key';

describe('camera vs screen overwrite check', () => {
  const interviewId = 'interview-1';
  const questionIndex = 0;
  const cameraKey = `dev/interviews/${interviewId}/answers/q0-camera-1.webm`;
  const screenKey = `dev/interviews/${interviewId}/answers/q0-screen-1.webm`;
  const version = { mediaKey: cameraKey, screenMediaKey: screenKey };

  it('allows screen key when camera already set, forbids a different camera key', () => {
    const existingForScreen = resolveVersionMediaKeyForArtifact({
      interviewId,
      questionIndex,
      mediaKey: screenKey,
      version,
    });
    expect(existingForScreen).toBe(screenKey);
    expect(
      getAnswerVersionOverwriteBlockReason(existingForScreen, screenKey),
    ).toBeNull();

    const existingForCamera = resolveVersionMediaKeyForArtifact({
      interviewId,
      questionIndex,
      mediaKey: cameraKey,
      version,
    });
    expect(existingForCamera).toBe(cameraKey);
    expect(
      getAnswerVersionOverwriteBlockReason(
        existingForCamera,
        `dev/interviews/${interviewId}/answers/q0-camera-2.webm`,
      ),
    ).toMatch(/already has uploaded media/i);

    const existingForNewScreen = resolveVersionMediaKeyForArtifact({
      interviewId,
      questionIndex,
      mediaKey: `dev/interviews/${interviewId}/answers/q0-screen-2.webm`,
      version,
    });
    expect(
      getAnswerVersionOverwriteBlockReason(
        existingForNewScreen,
        `dev/interviews/${interviewId}/answers/q0-screen-2.webm`,
      ),
    ).toMatch(/already has uploaded media/i);
  });
});
