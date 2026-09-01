const CYRILLIC_LETTER = '\\p{Script=Cyrillic}';
const CYRILLIC_START = `(?:^|[^${CYRILLIC_LETTER}\\p{N}_])`;
const CYRILLIC_END = `(?=[^${CYRILLIC_LETTER}\\p{N}_]|$)`;

const LATIN_LETTER = '\\p{Script=Latin}';
const LATIN_START = `(?:^|[^${LATIN_LETTER}\\p{N}_])`;
const LATIN_END = `(?=[^${LATIN_LETTER}\\p{N}_]|$)`;

export function cyrillicPattern(source: string, flags = 'iu'): RegExp {
  return new RegExp(`${CYRILLIC_START}${source}${CYRILLIC_END}`, flags);
}

export function cyrillicLoosePattern(source: string, flags = 'iu'): RegExp {
  return new RegExp(`${CYRILLIC_START}${source}`, flags);
}

export function latinPattern(source: string, flags = 'iu'): RegExp {
  return new RegExp(`${LATIN_START}${source}${LATIN_END}`, flags);
}

export function latinLoosePattern(source: string, flags = 'iu'): RegExp {
  return new RegExp(`${LATIN_START}${source}`, flags);
}

export const ASSIGN_HR_PATTERNS = [
  /\bassign\b.*\b(to|hr|reviewer)\b/i,
  /\bassign\b.*\bhr\b/i,
  /\bassign\s+reviewer\b/i,
  cyrillicPattern(
    'назнач(?:ь|ить|и)?(?:\\s+\\S+){0,12}(?:\\s+на\\s+|\\s+hr\\b|\\s+рекрут|\\s+reviewer)',
  ),
  cyrillicPattern(
    'прызнач(?:ь|ыць|и)?(?:\\s+\\S+){0,12}(?:\\s+на\\s+|\\s+hr\\b|\\s+рекрут|\\s+reviewer)',
  ),
  latinLoosePattern(
    'przypisz(?:\\s+\\S+){0,12}(?:\\s+(?:do|na)\\s+|\\s+hr\\b|\\s+reviewer)',
  ),
  latinLoosePattern(
    'przydziel(?:\\s+\\S+){0,12}(?:\\s+(?:do|na)\\s+|\\s+hr\\b|\\s+reviewer)',
  ),
];

export const UNASSIGNED_PATTERNS = [
  /\bunassigned\b/i,
  /\bno reviewer\b/i,
  /\bwithout (an )?hr\b/i,
  cyrillicPattern('не\\s+назначен'),
  cyrillicPattern(
    'не\\s+\\u043F\\u0440\\u044B\\u0437\\u043D\\u0430\\u0447\\u0430\\u043D',
  ),
  cyrillicPattern('без\\s+hr'),
  latinPattern('nie\\s+przypisan'),
  latinPattern('bez\\s+hr'),
];

export const LIST_HRS_PATTERNS = [
  /\b(show|list|get|display)\b(?:\s+\w+){0,4}\s+hrs?\b/i,
  /\b(show|list|get|display)\b(?:\s+\w+){0,4}\s+hr\s+reviewers?\b/i,
  /\bavailable\s+hr(?:\s+reviewers?)?\b/i,
  cyrillicLoosePattern('(?:покажи|список)(?:\\s+\\S+){0,8}\\s+hr'),
  cyrillicLoosePattern('(?:пакажы|спіс)(?:\\s+\\S+){0,8}\\s+hr'),
  latinLoosePattern('(?:poka[żz]|lista|wy[śs]wietl)(?:\\s+\\S+){0,8}\\s+hr'),
];

export const READY_FOR_REVIEW_PATTERNS = [
  /ready for (my )?review/i,
  /\bawaiting review\b/i,
  /\bneeds review\b/i,
  /\bwaiting for (my )?review\b/i,
  cyrillicPattern('готов(?:\\S+\\s+){0,4}к\\s+review'),
  cyrillicPattern('на\\s+review'),
  cyrillicPattern(
    '\\u0433\\u0430\\u0442\\u043E\\u0432(?:\\S+\\s+){0,4}\\u0434\\u0430\\s+review',
  ),
  latinLoosePattern('gotow(?:\\S+\\s+){0,4}do\\s+review'),
];

export const MY_INTERVIEWS_PATTERNS = [
  /\b(my interviews|show my interviews|list my interviews)\b/i,
  /\binterviews assigned to me\b/i,
  cyrillicLoosePattern('мои\\s+интерв'),
  cyrillicLoosePattern('мае\\s+инт'),
  latinLoosePattern('moje\\s+inter'),
  latinLoosePattern('moich\\s+inter'),
];

export const CANDIDATE_SCHEDULE_PATTERNS = [
  /\bwhen is my interview\b/i,
  /\bwhere is my interview\b/i,
  cyrillicLoosePattern('когда\\s+(?:\\S+\\s+){0,4}(?:мой\\s+)?интерв'),
  cyrillicLoosePattern('калі\\s+(?:\\S+\\s+){0,4}(?:мой\\s+)?(?:інт|инт)'),
  cyrillicLoosePattern('где\\s+(?:\\S+\\s+){0,4}(?:мой\\s+)?интерв'),
  cyrillicLoosePattern('дзе\\s+(?:\\S+\\s+){0,4}(?:мой\\s+)?(?:інт|инт)'),
  latinLoosePattern('kiedy\\s+(?:\\S+\\s+){0,4}(?:m[oó]j\\s+)?inter'),
  latinLoosePattern('gdzie\\s+(?:\\S+\\s+){0,4}(?:m[oó]j\\s+)?inter'),
];

export const CANDIDATE_OWN_STATUS_PATTERNS = [
  /\b(do i have an interview|have i got an interview)\b/i,
  /\bmy interview status\b/i,
  /\bstatus of my interview\b/i,
  ...CANDIDATE_SCHEDULE_PATTERNS,
  cyrillicLoosePattern('есть\\s+ли\\s+у\\s+меня\\s+интерв'),
  cyrillicLoosePattern('мой\\s+интерв'),
  cyrillicLoosePattern(
    '\\u0446\\u0456\\s+\\u0451\\u0441\\u0446\\u044C\\s+\\u0443\\s+\\u043C\\u044F\\u043D\\u0435\\s+\\u0456\\u043D\\u0442',
  ),
  cyrillicLoosePattern('мой\\s+\\u0456\\u043D\\u0442'),
  latinLoosePattern('czy\\s+mam\\s+inter'),
  latinLoosePattern('m[oó]j\\s+inter'),
];

export const REVIEW_STATE_PATTERNS = [
  /\b(reviewed|been reviewed|review state|review status)\b/i,
  /\bhas .+ been reviewed\b/i,
  /\bdid .+ get reviewed\b/i,
  /\bfeedback (shared|sent|published)\b/i,
  /\bshare link\b/i,
  cyrillicPattern('просмотрен'),
  cyrillicPattern('ревью'),
  cyrillicPattern('прагледжан'),
  cyrillicPattern('рэ\\u0456\\u0458\\u044E'),
  latinLoosePattern('przejrz'),
  latinLoosePattern('recenzj'),
];

export const INTERVIEW_STATUS_PATTERNS = [
  /\b(status of|status for|what is the status|what's the status)\b/i,
  /\bhow is .+ doing\b/i,
  /\bwhere is .+'s interview\b/i,
  /\bis .+ (done|finished|complete)\b/i,
  /\binterview status\b/i,
  cyrillicPattern('статус'),
  cyrillicLoosePattern('(?:какой|какая|какое|каков)(?:\\S+\\s+){0,6}статус'),
  cyrillicLoosePattern('(?:як(?:і|ая|ое)|які)(?:\\S+\\s+){0,6}(?:статус|інт)'),
  cyrillicLoosePattern('где\\s+(?:\\S+\\s+){0,6}интерв'),
  cyrillicLoosePattern('дзе\\s+(?:\\S+\\s+){0,6}(?:інт|инт)'),
  latinLoosePattern('(?:jaki|jaki\\s+jest)(?:\\s+\\S+){0,6}status'),
  latinLoosePattern('gdzie\\s+(?:\\S+\\s+){0,6}inter'),
  latinLoosePattern('status'),
];

export const LIST_INTERVIEWS_PATTERNS = [
  /\b(show|list|get|find|display)\b.*\binterviews?\b/i,
  /\binterviews?\b.*\b(show|list|pending|completed|failed|processing)\b/i,
  /\b(all|open|active|pending|completed) interviews?\b/i,
  /\binterviews by\b/i,
  cyrillicLoosePattern('(?:покажи|список|найди)(?:\\s+\\S+){0,8}\\s+интерв'),
  cyrillicLoosePattern(
    '(?:пакажы|спіс|знайдзі)(?:\\s+\\S+){0,8}\\s+(?:инт|інт)',
  ),
  latinLoosePattern('(?:poka[żz]|lista|znajd[źz])(?:\\s+\\S+){0,8}\\s+inter'),
];

export const SWITCH_LOCALE_PATTERNS = [
  /\b(?:switch|change|set)\s+(?:the\s+)?(?:app(?:lication)?\s+)?(?:locale|language)\s+to\b/i,
  /\blocale\s+to\b/i,
  cyrillicLoosePattern(
    '(?:переключ(?:и|ить)|смен(?:и|ить))\\s+(?:язык|locale)',
  ),
  cyrillicLoosePattern(
    '(?:пераключ(?:ы|ыць)|змяні(?:\\s+\\S+){0,2})(?:\\s+(?:мова|locale))',
  ),
  latinLoosePattern(
    '(?:prze[łl]ącz|zmie[nń]|ustaw)(?:\\s+\\S+){0,2}(?:\\s+(?:j[ęe]zyk|locale))',
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
  cyrillicLoosePattern('нов(?:ы|ая)\\s+чат'),
  cyrillicLoosePattern('пачаць\\s+спачатку'),
  cyrillicPattern('отмен'),
  cyrillicPattern('скасув'),
  latinLoosePattern('now(?:y|a)\\s+czat'),
  latinLoosePattern('zacznij\\s+od\\s+nowa'),
  latinPattern('anuluj'),
];

export const CREATE_INTERVIEW_PATTERNS = [
  /\bcreate (?:a )?new interview\b/i,
  /\bcreate (?:an )?interview for\b/i,
  /\bschedule (?:a )?new interview\b/i,
  /\bcreate (?:an )?interview\b/i,
  cyrillicLoosePattern('создай(?:\\s+\\S+){0,6}\\s+интерв'),
  cyrillicLoosePattern('ствары(?:\\s+\\S+){0,6}\\s+инт'),
  latinLoosePattern('(?:utw[oó]rz|stw[oó]rz)(?:\\s+\\S+){0,6}\\s+inter'),
];

export function matchesCreateInterviewIntent(message: string): boolean {
  if (/\b(?:questions?|pytani|pyta[nń]|вопрос|пытанн)\b/iu.test(message)) {
    return false;
  }
  if (
    /\b\d{1,2}\s+(?:questions?|вопрос(?:а|ов)?|pytani(?:a|e|ń)?|pyta[nń]|пытанн(?:е|і|я))\b/iu.test(
      message,
    )
  ) {
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
  cyrillicLoosePattern(
    '(?:ствары|стварыць|падрыхуй(?:\\s+\\S+){0,2})\\s+(?:\\d{1,2}\\s+)?(?:пытанн(?:е|і|я)|інт)',
  ),
  cyrillicLoosePattern(
    '(?:пытанн(?:е|і|я))(?:\\s+\\S+){0,8}(?:ствары|стварыць|падрыхуй)',
  ),
  latinLoosePattern(
    '(?:utw[oó]rz|stw[oó]rz|przygotuj)(?:\\s+\\S+){0,2}\\s+(?:\\d{1,2}\\s+)?(?:pytani(?:a|e|ń)?|pyta[nń]|inter)',
  ),
  latinLoosePattern(
    '(?:pytani(?:a|e|ń)?|pyta[nń])(?:\\s+\\S+){0,8}(?:utw[oó]rz|stw[oó]rz|przygotuj)',
  ),
];

export const CREATE_SINGLE_QUESTION_PATTERNS = [
  /\bcreate (?:a )?(?:new )?(?:interview )?question\b/i,
  /\badd (?:a )?(?:new )?(?:interview )?question\b/i,
  /\bmake (?:a )?(?:new )?(?:interview )?question\b/i,
  /\bhelp(?: me)? (?:to )?create (?:a )?(?:new )?(?:interview )?question\b/i,
  cyrillicLoosePattern('создай(?:\\s+\\S+){0,4}\\s+вопрос'),
  cyrillicLoosePattern('ствары(?:\\s+\\S+){0,4}\\s+пытанн'),
  latinLoosePattern('(?:utw[oó]rz|stw[oó]rz)(?:\\s+\\S+){0,4}\\s+pytani'),
];

export function matchesCreateSingleQuestionIntent(message: string): boolean {
  if (/\b\d{1,2}\s+questions?\b/i.test(message)) {
    return false;
  }
  if (
    /\b\d{1,2}\s+(?:вопрос(?:а|ов)?|pytani(?:a|e|ń)?|pyta[nń]|пытанн(?:е|і|я))\b/iu.test(
      message,
    )
  ) {
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
  cyrillicLoosePattern(
    '(?:сколько|кол(?:\\S+\\s+){0,2})(?:\\S+\\s+){0,8}\\s*вопрос',
  ),
  cyrillicLoosePattern(
    '(?:колькі|col(?:\\S+\\s+){0,2})(?:\\S+\\s+){0,8}(?:пытанн|пытан)',
  ),
  cyrillicLoosePattern(
    '(?:покажи|список|найди|всего|найти)(?:\\S+\\s+){0,8}\\s*вопрос',
  ),
  cyrillicLoosePattern(
    '(?:пакажы|спіс|знайдзі|усяго)(?:\\S+\\s+){0,8}(?:пытанн|пытан)',
  ),
  cyrillicLoosePattern('вопрос(?:\\S+\\s+){0,4}(?:с|где|фильтр|подход)'),
  cyrillicLoosePattern(
    '(?:пытанн|пытан)(?:\\S+\\s+){0,4}(?:з|дзе|фільтр|падход)',
  ),
  latinLoosePattern(
    '(?:ile|ilu|[łl]ącznie|razem|poka[żz]|lista|znajd[źz]|wy[śs]wietl)(?:\\s+\\S+){0,8}\\s*pytani',
  ),
  latinLoosePattern('pytani(?:\\s+\\S+){0,8}(?:z|w|z\\s+filtr|pasuj)'),
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
  // assesments? — intentional misspelling to match common user typos
  /\b(show|list|get|display|count|how many|total)\b.*\b(assessments?|assesments?|assignments?)\b/i,
  /\b(assessments?|assesments?|assignments?)\b.*\b(with|where|filtered|matching)\b/i,
  cyrillicLoosePattern(
    '(?:покажи|список|сколько|всего|найди)(?:\\S+\\s+){0,8}(?:assessment|assign)',
  ),
  cyrillicLoosePattern(
    '(?:пакажы|спіс|колькі|усяго|знайдзі)(?:\\S+\\s+){0,8}(?:assessment|assign)',
  ),
  cyrillicLoosePattern(
    '(?:assessment|assign)(?:\\S+\\s+){0,4}(?:с|где|фильтр|подход)',
  ),
  cyrillicLoosePattern(
    '(?:assessment|assign)(?:\\S+\\s+){0,4}(?:з|дзе|фільтр|падход)',
  ),
  latinLoosePattern(
    '(?:poka[żz]|lista|ile|razem|[łl]ącznie|znajd[źz]|wy[śs]wietl)(?:\\s+\\S+){0,8}(?:assessment|assign)',
  ),
  latinLoosePattern(
    '(?:assessment|assign)(?:\\s+\\S+){0,4}(?:z|w|z\\s+filtr|pasuj)',
  ),
];

export const INTERVIEW_ACTIVITY_SUMMARY_PATTERNS = [
  /\b(summarize|summary of|overview of)\b.*\b(interview|activity)\b/i,
  /\binterview activity\b/i,
  cyrillicLoosePattern(
    '(?:сводк|суммар|обзор|резюме)(?:\\S+\\s+){0,8}(?:интерв|активн)',
  ),
  cyrillicLoosePattern('активност(?:\\S+\\s+){0,4}интерв'),
  cyrillicLoosePattern('(?:агульн|агляд|актыўн)(?:\\S+\\s+){0,8}(?:інт|акт)'),
  latinLoosePattern(
    '(?:podsumow|przegl[aą]d|aktywn)(?:\\s+\\S+){0,8}(?:inter|aktyw)',
  ),
];

export const LIST_TEAM_PATTERNS = [
  /\b(show|list)\b.*\b(my )?team\b/i,
  /\bteam members?\b/i,
  cyrillicLoosePattern(
    '(?:покажи|список|выведи)(?:\\S+\\s+){0,8}(?:команд|team)',
  ),
  cyrillicLoosePattern(
    '(?:пакажы|спіс|вывядзі)(?:\\S+\\s+){0,8}(?:каманд|team)',
  ),
  cyrillicLoosePattern(
    '(?:член(?:ы|)|участник(?:и|))(?:\\S+\\s+){0,4}(?:команд|team)',
  ),
  cyrillicLoosePattern(
    '(?:член(?:ы|)|удзельнік(?:і|))(?:\\S+\\s+){0,4}(?:каманд|team)',
  ),
  cyrillicLoosePattern('(?:моя|мой|мои)\\s+(?:команд|team)'),
  cyrillicLoosePattern('(?:мая|мой|мае)\\s+(?:каманд|team)'),
  latinLoosePattern(
    '(?:poka[żz]|lista|wy[śs]wietl)(?:\\s+\\S+){0,8}(?:zesp[oó][łl]|team)',
  ),
  latinLoosePattern(
    '(?:cz[łl]onk|uczestnik)(?:\\s+\\S+){0,4}(?:zesp[oó][łl]|team)',
  ),
  latinLoosePattern('(?:m[oó]j|moj[aą])\\s+(?:zesp[oó][łl]|team)'),
];

const TEAM_ROLE_TERMS =
  'super[_\\s-]?admins?|admins?|hrs?|hr reviewers?|candidates?|админ(?:ы|ов|ам)?|адмін(?:ы|оў|ам)?|кандидат(?:ы|ов|ам)?|kandydat(?:ów|ami|y)?';

export const LIST_TEAM_BY_ROLE_PATTERNS = [
  new RegExp(`\\b(show|list)\\b.*\\ball\\b.*\\b(${TEAM_ROLE_TERMS})\\b`, 'i'),
  new RegExp(`\\b(show|list)\\b.*\\b(${TEAM_ROLE_TERMS})\\b`, 'i'),
  /\bteam members?\b.*\b(with|having)\b.*\b(super[_\s-]?admin|admin|hr|candidate)\b/i,
  cyrillicLoosePattern(
    `(?:покажи|список)(?:\\S+\\s+){0,4}(?:все|всех|всю)(?:\\S+\\s+){0,4}(?:${TEAM_ROLE_TERMS})`,
  ),
  cyrillicLoosePattern(
    `(?:пакажы|спіс)(?:\\S+\\s+){0,4}(?:усе|усі|усіх)(?:\\S+\\s+){0,4}(?:${TEAM_ROLE_TERMS})`,
  ),
  cyrillicLoosePattern(
    `(?:покажи|список|пакажы|спіс)(?:\\S+\\s+){0,8}(?:${TEAM_ROLE_TERMS})`,
  ),
  latinLoosePattern(
    `(?:poka[żz]|lista|wy[śs]wietl)(?:\\s+\\S+){0,4}(?:wszyscy|wszystkich|wszyscy|cał[ąa])?(?:\\s+\\S+){0,4}(?:${TEAM_ROLE_TERMS})`,
  ),
  cyrillicLoosePattern(
    `(?:команд|team|каманд)(?:\\S+\\s+){0,8}(?:с|маючы)(?:\\S+\\s+){0,8}(?:роль|role)(?:\\S+\\s+){0,4}(?:${TEAM_ROLE_TERMS})`,
  ),
  latinLoosePattern(
    `(?:zesp[oó][łl]|team)(?:\\s+\\S+){0,8}(?:z|mając)(?:\\s+\\S+){0,8}(?:rol[ęe]|role)(?:\\s+\\S+){0,4}(?:${TEAM_ROLE_TERMS})`,
  ),
];
