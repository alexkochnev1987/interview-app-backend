export const DEFAULT_MAX_ANSWER_ATTEMPTS_PER_QUESTION = 3;

export interface AnswerVersionRef {
  versionNumber: number;
}

export function resolveMaxAnswerAttemptsPerQuestion(): number {
  const raw = process.env.MAX_ANSWER_ATTEMPTS_PER_QUESTION?.trim();
  if (!raw) {
    return DEFAULT_MAX_ANSWER_ATTEMPTS_PER_QUESTION;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_MAX_ANSWER_ATTEMPTS_PER_QUESTION;
  }

  return parsed;
}

export function getSavedAnswerVersions(answer?: {
  versions?: AnswerVersionRef[];
  selectedVersionNumber?: number;
  mediaKey?: string;
}): AnswerVersionRef[] {
  if (!answer) {
    return [];
  }

  if (answer.versions?.length) {
    return answer.versions.map((version) => ({
      versionNumber: version.versionNumber,
    }));
  }

  if (answer.mediaKey) {
    return [{ versionNumber: answer.selectedVersionNumber ?? 1 }];
  }

  return [];
}

export function getAnswerAttemptLimitBlockReason(
  versions: AnswerVersionRef[],
  versionNumber?: number,
): string | null {
  const maxAttempts = resolveMaxAnswerAttemptsPerQuestion();
  const maxExistingVersionNumber = versions.reduce(
    (max, version) => Math.max(max, version.versionNumber),
    0,
  );
  const targetVersion =
    typeof versionNumber === 'number' && versionNumber > 0
      ? versionNumber
      : maxExistingVersionNumber + 1;

  if (targetVersion > maxAttempts) {
    return `A maximum of ${maxAttempts} recording attempts is allowed per question`;
  }

  const isNewVersion = !versions.some(
    (version) => version.versionNumber === targetVersion,
  );
  if (isNewVersion && versions.length >= maxAttempts) {
    return `A maximum of ${maxAttempts} recording attempts is allowed per question`;
  }

  return null;
}

export function getAnswerVersionNotReservedBlockReason(
  versions: AnswerVersionRef[],
  versionNumber?: number,
): string | null {
  if (typeof versionNumber !== 'number' || versionNumber < 1) {
    return 'A reserved recording attempt versionNumber is required';
  }

  if (!versions.some((version) => version.versionNumber === versionNumber)) {
    return 'Recording attempt must be reserved before upload';
  }

  return null;
}

export function getRecordingSessionLockBlockReason(
  lockedRecordingSessionId: string | undefined,
  recordingSessionId: string | undefined,
): string | null {
  const provided = recordingSessionId?.trim();
  if (!provided) {
    return 'recordingSessionId is required';
  }

  if (!lockedRecordingSessionId) {
    return 'Recording attempt must be reserved before upload';
  }

  if (lockedRecordingSessionId !== provided) {
    return 'recordingSessionId does not match the locked recording session';
  }

  return null;
}

/** Blocks replacing an already-uploaded mediaKey with a different one. */
export function getAnswerVersionOverwriteBlockReason(
  existingMediaKey: string | undefined,
  nextMediaKey?: string,
): string | null {
  const existing = existingMediaKey?.trim();
  if (!existing) {
    return null;
  }

  if (nextMediaKey === undefined) {
    return 'This recording attempt already has uploaded media';
  }

  const next = nextMediaKey.trim();
  if (next && next !== existing) {
    return 'This recording attempt already has uploaded media';
  }

  return null;
}
