import { Answer, AnswerVersion } from './interfaces/interview.interface';

export function resolveSelectedAnswerVersion(
  answer: Answer,
): AnswerVersion | undefined {
  if (answer.versions?.length) {
    return (
      answer.versions.find(
        (version) =>
          version.versionNumber === (answer.selectedVersionNumber ?? 1),
      ) ?? answer.versions[answer.versions.length - 1]
    );
  }

  if (!answer.mediaKey) {
    return undefined;
  }

  return {
    versionNumber: answer.selectedVersionNumber ?? 1,
    mediaKey: answer.mediaKey,
    screenMediaKey: answer.screenMediaKey,
    uploadedAt: answer.uploadedAt,
    durationSeconds: answer.durationSeconds,
    startedAt: answer.startedAt,
    submittedAt: answer.submittedAt,
    camera: answer.camera,
    screen: answer.screen,
    behaviorSignals: answer.behaviorSignals,
    behaviorEvents: answer.behaviorEvents,
  };
}
