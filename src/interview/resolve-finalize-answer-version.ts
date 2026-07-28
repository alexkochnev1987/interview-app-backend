export interface AnswerVersionMediaRef {
  versionNumber: number;
  mediaKey?: string;
}

function versionHasUploadedMedia(version: AnswerVersionMediaRef): boolean {
  return Boolean(version.mediaKey?.trim());
}

export function resolveLatestVersionWithMedia(
  versions: AnswerVersionMediaRef[],
): number | undefined {
  const latestWithMedia = versions
    .filter(versionHasUploadedMedia)
    .sort((left, right) => right.versionNumber - left.versionNumber)[0];

  return latestWithMedia?.versionNumber;
}

export function resolveFinalizeAnswerVersionNumber(
  answer: { selectedVersionNumber?: number },
  versions: AnswerVersionMediaRef[],
): number | undefined {
  if (versions.length === 0) {
    return undefined;
  }

  const maxVersionNumber = versions.reduce(
    (max, version) => Math.max(max, version.versionNumber),
    0,
  );
  const selectedNumber = answer.selectedVersionNumber ?? maxVersionNumber;
  const selectedVersion = versions.find(
    (version) => version.versionNumber === selectedNumber,
  );

  if (selectedVersion && versionHasUploadedMedia(selectedVersion)) {
    return selectedNumber;
  }

  return resolveLatestVersionWithMedia(versions);
}
