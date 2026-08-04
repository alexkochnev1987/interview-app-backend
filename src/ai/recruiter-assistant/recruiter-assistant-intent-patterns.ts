const CYRILLIC_LETTER = '\\p{Script=Cyrillic}';
const CYRILLIC_START = `(?:^|[^${CYRILLIC_LETTER}\\p{N}_])`;
const CYRILLIC_END = `(?=[^${CYRILLIC_LETTER}\\p{N}_]|$)`;

export function cyrillicPattern(source: string, flags = 'iu'): RegExp {
  return new RegExp(`${CYRILLIC_START}${source}${CYRILLIC_END}`, flags);
}

export function cyrillicLoosePattern(source: string, flags = 'iu'): RegExp {
  return new RegExp(`${CYRILLIC_START}${source}`, flags);
}

export const ASSIGN_HR_PATTERNS = [
  /\bassign\b.*\b(to|hr|reviewer)\b/i,
  /\bassign\b.*\bhr\b/i,
  /\bassign\s+reviewer\b/i,
  cyrillicPattern('назнач(?:ь|ить|и)?(?:\\s+\\S+){0,12}(?:\\s+на\\s+|\\s+hr\\b|\\s+рекрут|\\s+reviewer)'),
];

export const UNASSIGNED_PATTERNS = [
  /\bunassigned\b/i,
  /\bno reviewer\b/i,
  /\bwithout (an )?hr\b/i,
  cyrillicPattern('не\\s+назначен'),
  cyrillicPattern('без\\s+hr'),
];

export const READY_FOR_REVIEW_PATTERNS = [
  /ready for (my )?review/i,
  /\bawaiting review\b/i,
  /\bneeds review\b/i,
  /\bwaiting for (my )?review\b/i,
  cyrillicPattern('готов(?:\\S+\\s+){0,4}к\\s+review'),
  cyrillicPattern('на\\s+review'),
];

export const MY_INTERVIEWS_PATTERNS = [
  /\b(my interviews|show my interviews|list my interviews)\b/i,
  /\binterviews assigned to me\b/i,
  cyrillicLoosePattern('мои\\s+интерв'),
];

export const CANDIDATE_SCHEDULE_PATTERNS = [
  /\bwhen is my interview\b/i,
  /\bwhere is my interview\b/i,
];

export const CANDIDATE_OWN_STATUS_PATTERNS = [
  /\b(do i have an interview|have i got an interview)\b/i,
  /\bmy interview status\b/i,
  /\bstatus of my interview\b/i,
  ...CANDIDATE_SCHEDULE_PATTERNS,
  cyrillicLoosePattern('есть\\s+ли\\s+у\\s+меня\\s+интерв'),
  cyrillicLoosePattern('мой\\s+интерв'),
];

export const REVIEW_STATE_PATTERNS = [
  /\b(reviewed|been reviewed|review state|review status)\b/i,
  /\bhas .+ been reviewed\b/i,
  /\bdid .+ get reviewed\b/i,
  /\bfeedback (shared|sent|published)\b/i,
  /\bshare link\b/i,
  cyrillicPattern('просмотрен'),
  cyrillicPattern('ревью'),
];

export const INTERVIEW_STATUS_PATTERNS = [
  /\b(status of|status for|what is the status|what's the status)\b/i,
  /\bhow is .+ doing\b/i,
  /\bwhere is .+'s interview\b/i,
  /\bis .+ (done|finished|complete)\b/i,
  /\binterview status\b/i,
  cyrillicPattern('статус'),
];

export const LIST_INTERVIEWS_PATTERNS = [
  /\b(show|list|get|find|display)\b.*\binterviews?\b/i,
  /\binterviews?\b.*\b(show|list|pending|completed|failed|processing)\b/i,
  /\b(all|open|active|pending|completed) interviews?\b/i,
  /\binterviews by\b/i,
  cyrillicLoosePattern('(?:покажи|список|найди)(?:\\s+\\S+){0,8}\\s+интерв'),
];

export const SWITCH_LOCALE_PATTERNS = [
  /\b(?:switch|change|set)\s+(?:the\s+)?(?:app(?:lication)?\s+)?(?:locale|language)\s+to\b/i,
  /\blocale\s+to\b/i,
  cyrillicLoosePattern('(?:переключ(?:и|ить)|смен(?:и|ить))\\s+(?:язык|locale)'),
];

export const NEW_CHAT_PATTERNS = [
  /\bnew chat\b/i,
  /\bstart (?:a )?new conversation\b/i,
  /\breset (?:the )?conversation\b/i,
  /\bclear (?:the )?chat\b/i,
  cyrillicLoosePattern('нов(?:ый|ая)\\s+чат'),
  cyrillicLoosePattern('начать\\s+заново'),
];

export const CREATE_INTENT_PATTERNS = [
  /\b(?:prepare|generate|create|make|draft|need)\s+(?:\d{1,2}\s+)?questions?\b/i,
  /\bset up\s+(?:an?\s+)?(?:interview|questions?\b)/i,
  /\bcreate (an )?interview\b/i,
  /\bmake interview\b/i,
  /\bgenerate questions\b/i,
  cyrillicLoosePattern('(?:создай|создать|подготов(?:ь|ить|ьте)?)\\s+(?:\\d{1,2}\\s+)?(?:вопрос|вопросы|интерв)'),
  cyrillicLoosePattern('(?:вопрос|вопросы)(?:\\s+\\S+){0,8}(?:создай|создать|подготов(?:ь|ить|ьте)?)'),
];

export const CREATE_SINGLE_QUESTION_PATTERNS = [
  /\bcreate (?:a )?question\b/i,
  /\badd (?:a )?(?:new )?question\b/i,
  /\bmake (?:a )?(?:new )?question\b/i,
  cyrillicLoosePattern('создай(?:\\s+\\S+){0,4}\\s+вопрос'),
];

export function matchesCreateSingleQuestionIntent(message: string): boolean {
  if (/\b\d{1,2}\s+questions?\b/i.test(message)) {
    return false;
  }
  if (/\b\d{1,2}\s+(?:вопрос(?:а|ов)?)\b/i.test(message)) {
    return false;
  }
  return matchesAnyPattern(message, CREATE_SINGLE_QUESTION_PATTERNS);
}

export function matchesAnyPattern(message: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(message));
}

export function matchesCreateIntent(message: string): boolean {
  return matchesAnyPattern(message, CREATE_INTENT_PATTERNS);
}
