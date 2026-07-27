import { Answer } from '../interview/interfaces/interview.interface';
import { resolveSelectedAnswerVersion } from '../interview/resolve-selected-answer-version';

export interface CurrentAnswerMeta {
  status: 'recording' | 'submitted';
  versionCount: number;
  selectedVersionNumber: number;
  hasMediaOnSelectedVersion: boolean;
  recordingSessionId?: string;
}

export function buildCurrentAnswerMeta(answer: Answer): CurrentAnswerMeta {
  const selectedVersion = resolveSelectedAnswerVersion(answer);
  const selectedVersionNumber =
    selectedVersion?.versionNumber ??
    answer.selectedVersionNumber ??
    1;

  return {
    status: answer.status,
    versionCount: answer.versions?.length ?? (answer.mediaKey ? 1 : 0),
    selectedVersionNumber,
    hasMediaOnSelectedVersion: Boolean(selectedVersion?.mediaKey?.trim()),
    ...(answer.recordingSessionId
      ? { recordingSessionId: answer.recordingSessionId }
      : {}),
  };
}
