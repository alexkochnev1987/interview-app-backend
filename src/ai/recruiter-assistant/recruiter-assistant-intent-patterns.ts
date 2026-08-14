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
  cyrillicPattern(
    'назнач(?:ь|ить|и)?(?:\\s+\\S+){0,12}(?:\\s+на\\s+|\\s+hr\\b|\\s+рекрут|\\s+reviewer)',
  ),
];

export const UNASSIGNED_PATTERNS = [
  /\bunassigned\b/i,
  /\bno reviewer\b/i,
  /\bwithout (an )?hr\b/i,
  cyrillicPattern('не\\s+назначен'),
  cyrillicPattern('без\\s+hr'),
];

export const LIST_HRS_PATTERNS = [
  /\b(show|list|get|display)\b(?:\s+\w+){0,4}\s+hrs?\b/i,
  /\b(show|list|get|display)\b(?:\s+\w+){0,4}\s+hr\s+reviewers?\b/i,
  /\bavailable\s+hr(?:\s+reviewers?)?\b/i,
  cyrillicLoosePattern('(?:покажи|список)(?:\\s+\\S+){0,8}\\s+hr'),
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
  cyrillicLoosePattern(
    '(?:переключ(?:и|ить)|смен(?:и|ить))\\s+(?:язык|locale)',
  ),
];

export const NEW_CHAT_PATTERNS = [
  /\bnew chat\b/i,
  /\bstart (?:a )?new conversation\b/i,
  /\breset (?:the )?conversation\b/i,
  /\bclear (?:the )?chat\b/i,
  /^\s*cancel\s*$/i,
  /^\s*abort\s*$/i,
  cyrillicLoosePattern('нов(?:ый|ая)\\s+чат'),
  cyrillicLoosePattern('начать\\s+заново'),
];

export const CREATE_INTERVIEW_PATTERNS = [
  /\bcreate (?:a )?new interview\b/i,
  /\bcreate (?:an )?interview for\b/i,
  /\bschedule (?:a )?new interview\b/i,
  /\bcreate (?:an )?interview\b/i,
  cyrillicLoosePattern('создай(?:\\s+\\S+){0,6}\\s+интерв'),
];

export function matchesCreateInterviewIntent(message: string): boolean {
  if (/\bquestions?\b/i.test(message)) {
    return false;
  }
  if (/\b\d{1,2}\s+(?:questions?|вопрос(?:а|ов)?)\b/i.test(message)) {
    return false;
  }
  if (/\bset up\s+(?:an?\s+)?interview\b/i.test(message)) {
    return false;
  }
  return matchesAnyPattern(message, CREATE_INTERVIEW_PATTERNS);
}

export const CREATE_INTENT_PATTERNS = [
  /\bset up\s+(?:an?\s+)?(?:interview|questions?\b)/i,
  /\bmake interview\b/i,
  cyrillicLoosePattern(
    '(?:создай|создать|подготов(?:ь|ить|ьте)?)\\s+(?:\\d{1,2}\\s+)?(?:вопрос|вопросы|интерв)',
  ),
  cyrillicLoosePattern(
    '(?:вопрос|вопросы)(?:\\s+\\S+){0,8}(?:создай|создать|подготов(?:ь|ить|ьте)?)',
  ),
];

export const CREATE_SINGLE_QUESTION_PATTERNS = [
  /\bcreate (?:a )?(?:new )?(?:interview )?question\b/i,
  /\badd (?:a )?(?:new )?(?:interview )?question\b/i,
  /\bmake (?:a )?(?:new )?(?:interview )?question\b/i,
  /\bhelp(?: me)? (?:to )?create (?:a )?(?:new )?(?:interview )?question\b/i,
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

export function matchesAnyPattern(
  message: string,
  patterns: RegExp[],
): boolean {
  return patterns.some((pattern) => pattern.test(message));
}

export function matchesCreateIntent(message: string): boolean {
  return matchesAnyPattern(message, CREATE_INTENT_PATTERNS);
}

export const COUNT_QUESTIONS_PATTERNS = [
  /\bhow many\b.*\bquestions?\b/i,
  /\bcount\b.*\bquestions?\b/i,
  /\btotal\b.*\bquestions?\b/i,
  /\b(show|list|display|find|browse)\b.*\bquestions?\b/i,
  /\bquestions?\b.*\b(with|where|filtered|matching)\b/i,
];

export function matchesCountQuestionsIntent(message: string): boolean {
  if (matchesCreateSingleQuestionIntent(message)) {
    return false;
  }
  if (matchesCreateIntent(message)) {
    return false;
  }
  return matchesAnyPattern(message, COUNT_QUESTIONS_PATTERNS);
}

export const LIST_ASSESSMENTS_PATTERNS = [
  /\b(show|list|get|display|count|how many|total)\b.*\b(assessments?|assesments?|assignments?)\b/i,
  /\b(assessments?|assesments?|assignments?)\b.*\b(with|where|filtered|matching)\b/i,
];

export const INTERVIEW_ACTIVITY_SUMMARY_PATTERNS = [
  /\b(summarize|summary of|overview of)\b.*\b(interview|activity)\b/i,
  /\binterview activity\b/i,
];

export const LIST_TEAM_PATTERNS = [
  /\b(show|list)\b.*\b(my )?team\b/i,
  /\bteam members?\b/i,
];

export const LIST_TEAM_BY_ROLE_PATTERNS = [
  /\b(show|list)\b.*\ball\b.*\b(super[_\s-]?admins?|admins?|hrs?|hr reviewers?|candidates?)\b/i,
  /\b(show|list)\b.*\b(super[_\s-]?admins?|candidates?)\b/i,
  /\bteam members?\b.*\b(with|having)\b.*\b(super[_\s-]?admin|admin|hr|candidate)\b/i,
];
