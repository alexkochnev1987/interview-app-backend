export type InterviewMediaType = 'camera' | 'screen';

interface BuildInterviewMediaKeyParams {
  prefix: string;
  interviewId: string;
  questionIndex: number;
  mediaType: InterviewMediaType;
  timestamp?: number;
}

interface MatchInterviewMediaKeyParams {
  mediaKey: string;
  interviewId: string;
  questionIndex: number;
  mediaType?: InterviewMediaType;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizePrefix(prefix: string): string {
  const trimmed = prefix.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `${trimmed}/` : '';
}

export function buildInterviewMediaKey({
  prefix,
  interviewId,
  questionIndex,
  mediaType,
  timestamp = Date.now(),
}: BuildInterviewMediaKeyParams): string {
  return `${normalizePrefix(prefix)}interviews/${interviewId}/answers/q${questionIndex}-${mediaType}-${timestamp}.webm`;
}

export function matchesInterviewMediaKey({
  mediaKey,
  interviewId,
  questionIndex,
  mediaType,
}: MatchInterviewMediaKeyParams): boolean {
  const normalizedMediaKey = mediaKey.trim();
  const mediaTypePattern = mediaType
    ? escapeRegExp(mediaType)
    : '(?:camera|screen)';
  const pattern = new RegExp(
    `^(?:.*?/)?interviews/${escapeRegExp(
      interviewId,
    )}/answers/q${questionIndex}-${mediaTypePattern}-\\d+\\.webm$`,
  );

  return pattern.test(normalizedMediaKey);
}
