import { Answer } from '../interview/interfaces/interview.interface';
import { resolveLatestVersionWithMedia } from '../interview/resolve-finalize-answer-version';
import { resolveSelectedAnswerVersion } from '../interview/resolve-selected-answer-version';

export interface CurrentAnswerMeta {
  status: 'recording' | 'submitted';
  versionCount: number;
  selectedVersionNumber: number;
  hasSubmittableMedia: boolean;
  latestSubmittableVersionNumber: number | null;
}

function listAnswerVersionsForMeta(
  answer: Answer,
): { versionNumber: number; mediaKey?: string }[] {
  if (answer.versions?.length) {
    return answer.versions;
  }

  if (answer.mediaKey?.trim()) {
    return [
      {
        versionNumber: answer.selectedVersionNumber ?? 1,
        mediaKey: answer.mediaKey,
      },
    ];
  }

  return [];
}

export function buildCurrentAnswerMeta(answer: Answer): CurrentAnswerMeta {
  const selectedVersion = resolveSelectedAnswerVersion(answer);
  const selectedVersionNumber =
    selectedVersion?.versionNumber ?? answer.selectedVersionNumber ?? 1;
  const latestSubmittableVersionNumber =
    resolveLatestVersionWithMedia(listAnswerVersionsForMeta(answer)) ?? null;

  return {
    status: answer.status,
    versionCount: answer.versions?.length ?? (answer.mediaKey ? 1 : 0),
    selectedVersionNumber,
    hasSubmittableMedia: latestSubmittableVersionNumber !== null,
    latestSubmittableVersionNumber,
  };
}
