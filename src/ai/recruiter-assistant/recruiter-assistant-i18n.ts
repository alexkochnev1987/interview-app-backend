import { Locale } from '../../locale/locale.constants';

const EN_MESSAGES = {
  // POLICY
  outOfScope:
    'I can help with interviews, question counts, assessments, team members, activity summaries, assignments, and question setup inside this app.',
  outOfScopeCandidate:
    'I can help with your interview status, review updates, and incomplete interviews.',
  disabledGlobal: 'Recruiter assistant is disabled in this environment.',
  disabledForRole:
    'Recruiter assistant is not available for your role in this environment.',
  newChatWelcome:
    'Started a new conversation. How can I help with interviews, questions, or assignments?',
  newChatWelcomeCandidate:
    'Started a new conversation. Ask about your interview status, whether feedback is ready, or interviews you still need to complete.',

  // SERVICE
  cancelled: 'Cancelled. No changes were made.',
  confirmationExpired:
    'That confirmation expired, was already used, or does not belong to your account.',
  confirmationApplyFailed:
    'That confirmation could not be applied. Please review the question list and try again.',

  // TOOLS — PERMISSIONS
  'denied.listInterviews': 'You do not have permission to list interviews.',
  'denied.readQuestions':
    'You do not have permission to read the question bank.',
  'denied.readAssessments': 'You do not have permission to read assessments.',
  'denied.summarizeActivity':
    'You do not have permission to summarize interview activity.',
  'denied.listTeam': 'You do not have permission to list team members.',
  'denied.listHrs': 'Only admins can list HR reviewers.',
  'denied.lookupStatus':
    'You do not have permission to look up interview status.',
  'denied.checkReview': 'You do not have permission to check review state.',
  'denied.assignHr': 'Only admins can assign HR reviewers.',
  'denied.createQuestions': 'You do not have permission to create questions.',
  'denied.createInterviews': 'You do not have permission to create interviews.',
  'denied.readQuestionsForPrep':
    'You do not have permission to read the question bank for interview preparation.',
  'denied.candidatesOnly': 'That question is only for candidates.',
  'denied.candidateOwnReviewOnly':
    'You can only check the review state of your own interviews.',

  // TOOLS — LIST/QUERY
  'answered.noInterviewsReadyForReview':
    'No completed interviews are ready for your review.',
  'answered.noInterviewsMatched': 'No interviews matched your request.',
  'answered.interviewsFound': 'Found {total} interview(s). Showing {count}.',
  'answered.questionsCountFiltered':
    '{total} question(s) match your filters. Open the question bank to browse them.',
  'answered.questionsCountTotal':
    'You have {total} question(s) in total. Open the question bank to browse them.',
  'answered.assessmentsCountFiltered':
    '{total} assessment(s) match your filters.{truncatedNote} Open the assessments page to browse them.',
  'answered.assessmentsCountTotal':
    'You have {total} assessment(s) in total.{truncatedNote} Open the assessments page to browse them.',
  'answered.assessmentsTruncatedNote':
    ' (count from the {scanLimit} most recently updated interviews; open the assessments page for the full list)',
  'answered.activitySummary':
    'Your org has {total} interview(s): {active} active, {completed} completed, {failed} failed.',
  'answered.noTeamMembers': 'No team members found.',
  'answered.teamMembersListed':
    '{summaryLine}Showing {count}{roleLabel} team member(s).',
  'answered.noHrs': 'No HR reviewers available.',
  'answered.hrsFound': 'Found {count} HR reviewer(s).',
  'answered.interviewNotFound':
    'I could not find a unique interview. Provide an interview id or candidate name.',
  'answered.interviewStatus':
    "{candidateName}'s interview for {position} is {status}.",
  'answered.interviewReviewed':
    "{candidateName}'s interview has been reviewed{outcome}.",
  'answered.interviewNotReviewed':
    "{candidateName}'s interview has not been reviewed yet.",

  // TOOLS — FLOWS
  'flow.askQuestionName': 'What should the question be called?',
  'flow.askPosition': 'What position is the interview for?',
  'flow.askCandidateName': "What is the candidate's name?",
  'flow.pickTemplate': 'Pick a number from the list or say "create my own".',
  'flow.openInterviewForm': 'Opening the interview form.',
  'flow.templateOutOfRange':
    'Template {index} is not in the list. Pick a number from 1 to {max} or say "create my own".',
  'flow.templateNoQuestions':
    'Template "{templateName}" has no available questions. Try another template or say "create my own".',
  'flow.createInterviewConfirm':
    'Create interview for {candidateName} using "{templateName}" ({questionCount} questions)? Reply yes to confirm.',
  'flow.noTemplates':
    'No templates found for {position}. Say "create my own" to open the interview form.',
  'flow.templatesFound':
    'Found {count} template(s) for {position}. Choose a number or say "create my own".',
  'flow.pickCandidate':
    'Pick a registered candidate or type a new candidate name.',
  'flow.pickCandidateFromList':
    'Pick a registered candidate from the list or type a new candidate name.',
  'flow.candidatesMatching':
    'Found {count} registered candidates matching "{name}". Pick one or type a new name.',
  'flow.candidateNotInList':
    'That candidate is not in the list. Pick one from the list or type a new name.',
  'flow.confirmRegisteredCandidate':
    'Use registered candidate {name} ({email})? Reply yes or no.',
  'flow.similarQuestions':
    'Found {count} similar question(s) (≥80%). Still add "{questionName}"? Reply yes to continue or no to abort.',
  'flow.similarQuestionsRetry':
    '{previousMessage} Reply yes to try again, or no/cancel to abort.',
  'flow.similarQuestionsReprompt':
    'Reply yes to add the question anyway, or no/cancel to abort.',
  'flow.createQuestionConfirm':
    'Create question "{questionName}" with AI suggestions? Reply yes to confirm.',
  'flow.questionDraftFailed':
    'I could not generate AI suggestions for that question.',
  'flow.questionDraftGenerationFailed':
    'Question draft generation failed. Try again or create the question manually.',
  'flow.assignInterviewPrompt': 'Which interview should I assign?',
  'flow.assignHrPrompt': 'Which HR reviewer should I assign?',
  'flow.assignInterviewAmbiguous':
    "Couldn't detect singular interview, please choose from the list",
  'flow.assignHrAmbiguous':
    "Couldn't detect singular HR, please choose from the list",
  'flow.assignHrConfirm':
    'Assign {interviewLabel} to {hrName}? Reply yes to confirm.',
  'flow.noUnassignedInterviews': 'No unassigned interviews available.',

  // LOCALE
  'locale.unsupported':
    '"{token}" is not a supported locale. Supported: en, be, ru, pl.',
  'locale.switchHint': 'Say "switch locale to ru" (supported: en, be, ru, pl).',
  'locale.switched': 'Application language switched to {locale}.',

  // CANDIDATE
  'candidate.status.readyToStart': 'ready to start',
  'candidate.status.inProgress': 'in progress',
  'candidate.status.submittedReview': 'submitted and under review',
  'candidate.status.reviewComplete': 'review complete',
  'candidate.status.submittedWaiting': 'submitted, waiting for feedback',
  'candidate.status.failed': 'failed',
  'candidate.statusResponse': 'Your interview for {position} is {statusLabel}.',
  'candidate.statusResponseSchedule':
    'Your interview for {position} is {statusLabel}. It was created on {createdDate}. This app does not store a separate interview time or location yet — use your interview link when the status is pending or in progress.',
  'candidate.reviewed': 'Your {position} interview has been reviewed{outcome}.',
  'candidate.submittedNotReviewed':
    'Your {position} interview has been submitted but has not been reviewed yet.',
  'candidate.notReviewed':
    'Your {position} interview has not been reviewed yet.',
  'candidate.ambiguousPosition':
    'I found multiple interviews matching that position: {options}. Please specify the exact role name.',
  'candidate.unknownPosition':
    'I couldn\'t find an interview for "{query}". Your interviews: {available}.',
  'candidate.noInterviews': 'You do not have any interviews yet.',
  'candidate.noActiveInterviews':
    'You have no interviews waiting to be completed.',
  'candidate.oneActiveInterview':
    'You have 1 interview to complete: {description}.',
  'candidate.multipleActiveInterviews':
    'You have {count} interviews to complete: {descriptions}.',
  'candidate.allInterviews': 'You have {count} interview(s): {summary}.',
  'candidate.onlyOwnReview':
    'You can only check the review state of your own interviews.',

  // PENDING ACTION EXECUTOR
  'executed.assignedHr': 'Assigned {interviewLabel} to {hrName}.',
  'refused.assignHrFailed':
    'I could not assign that HR reviewer. Check the interview and reviewer ids and try again.',
  'executed.questionCreated': 'Created question "{questionText}".',
  'refused.questionCreateFailed': 'Question creation failed. Please try again.',
  'refused.cannotCreateQuestionsPermission':
    'I cannot create the missing questions because your user does not have questions:create permission.',
  'refused.cannotCreateInterviewPermission':
    'I cannot create the interview because your user does not have interviews:create permission.{rollbackNote}',
  'refused.questionsFailedPartial':
    'Question creation failed partway through. Any new questions from this attempt were rolled back; no interview was created.',
  'refused.questionsFailed':
    'Something went wrong while creating questions. No questions or interview were created; please start again.',
  'executed.questionsOnlyReady':
    'No new questions were needed. The suggested set is ready.',
  'executed.questionsCreated':
    'Created {count} missing questions. Send me the candidate name when you want to create the interview.',
  'executed.interviewCreated':
    'Interview created for {candidateName}. {questionCount} question(s) attached.',
  'refused.interviewCreateFailed':
    'Interview creation failed. Any new questions from this attempt were rolled back; please start again.',

  // QUESTION PLAN
  'questionPlan.allMatched':
    'All suggested questions already have close matches in the question bank.',
  'questionPlan.foundMatches':
    'I found {existingCount} close matches and {missingCount} questions would need to be created.',
  'questionPlan.noCreatePermission':
    'I found {existingCount} close matches and {missingCount} gaps, but your user cannot create questions.',
  'questionPlan.confirmWithInterview':
    'Confirm and I will create the missing questions, then create the interview for {candidateName}.',
  'questionPlan.confirmQuestionsOnly':
    'Confirm and I will create the missing questions. Send the candidate name when you want me to create the interview.',
  'questionPlan.noInterviewPermission':
    'Your user cannot create interviews, so I can only prepare the question set.',
} as const;

export type AssistantMessageKey = keyof typeof EN_MESSAGES;

type MessageCatalog = Record<AssistantMessageKey, string>;

const RU_MESSAGES: MessageCatalog = {
  outOfScope:
    'Я могу помочь с интервью, подсчётом вопросов, оценками, участниками команды, сводками активности, назначениями и настройкой вопросов в этом приложении.',
  outOfScopeCandidate:
    'Я могу помочь со статусом вашего интервью, обновлениями по ревью и незавершёнными интервью.',
  disabledGlobal: 'Рекрутерский ассистент отключён в этой среде.',
  disabledForRole:
    'Рекрутерский ассистент недоступен для вашей роли в этой среде.',
  newChatWelcome:
    'Начат новый диалог. Чем помочь с интервью, вопросами или назначениями?',
  newChatWelcomeCandidate:
    'Начат новый диалог. Спросите о статусе интервью, готовности обратной связи или интервью, которые ещё нужно пройти.',

  cancelled: 'Отменено. Изменения не были внесены.',
  confirmationExpired:
    'Это подтверждение истекло, уже было использовано или не принадлежит вашему аккаунту.',
  confirmationApplyFailed:
    'Это подтверждение не удалось применить. Проверьте список вопросов и попробуйте снова.',

  'denied.listInterviews': 'У вас нет прав на просмотр списка интервью.',
  'denied.readQuestions': 'У вас нет прав на чтение банка вопросов.',
  'denied.readAssessments': 'У вас нет прав на просмотр оценок.',
  'denied.summarizeActivity':
    'У вас нет прав на формирование сводки активности по интервью.',
  'denied.listTeam': 'У вас нет прав на просмотр участников команды.',
  'denied.listHrs': 'Только администраторы могут просматривать HR-ревьюеров.',
  'denied.lookupStatus': 'У вас нет прав на поиск статуса интервью.',
  'denied.checkReview': 'У вас нет прав на проверку состояния ревью.',
  'denied.assignHr': 'Только администраторы могут назначать HR-ревьюеров.',
  'denied.createQuestions': 'У вас нет прав на создание вопросов.',
  'denied.createInterviews': 'У вас нет прав на создание интервью.',
  'denied.readQuestionsForPrep':
    'У вас нет прав на чтение банка вопросов для подготовки интервью.',
  'denied.candidatesOnly': 'Этот вопрос предназначен только для кандидатов.',
  'denied.candidateOwnReviewOnly':
    'Вы можете проверять состояние ревью только своих интервью.',

  'answered.noInterviewsReadyForReview':
    'Нет завершённых интервью, готовых к вашему ревью.',
  'answered.noInterviewsMatched': 'Ни одно интервью не соответствует запросу.',
  'answered.interviewsFound': 'Найдено интервью: {total}. Показано: {count}.',
  'answered.questionsCountFiltered':
    '{total} вопрос(ов) соответствуют вашим фильтрам. Откройте банк вопросов для просмотра.',
  'answered.questionsCountTotal':
    'Всего у вас {total} вопрос(ов). Откройте банк вопросов для просмотра.',
  'answered.assessmentsCountFiltered':
    '{total} оценок соответствуют вашим фильтрам.{truncatedNote} Откройте страницу оценок для просмотра.',
  'answered.assessmentsCountTotal':
    'Всего у вас {total} оценок.{truncatedNote} Откройте страницу оценок для просмотра.',
  'answered.assessmentsTruncatedNote':
    ' (подсчёт по {scanLimit} последним обновлённым интервью; откройте страницу оценок для полного списка)',
  'answered.activitySummary':
    'В вашей организации {total} интервью: {active} активных, {completed} завершённых, {failed} неудачных.',
  'answered.noTeamMembers': 'Участники команды не найдены.',
  'answered.teamMembersListed':
    '{summaryLine}Показано участников команды{roleLabel}: {count}.',
  'answered.noHrs': 'HR-ревьюеры недоступны.',
  'answered.hrsFound': 'Найдено HR-ревьюеров: {count}.',
  'answered.interviewNotFound':
    'Не удалось найти одно интервью. Укажите id интервью или имя кандидата.',
  'answered.interviewStatus':
    'Интервью кандидата {candidateName} на позицию {position}: {status}.',
  'answered.interviewReviewed':
    'Интервью кандидата {candidateName} проверено{outcome}.',
  'answered.interviewNotReviewed':
    'Интервью кандидата {candidateName} ещё не проверено.',

  'flow.askQuestionName': 'Как назвать вопрос?',
  'flow.askPosition': 'Для какой позиции это интервью?',
  'flow.askCandidateName': 'Как зовут кандидата?',
  'flow.pickTemplate': 'Выберите номер из списка или напишите «create my own».',
  'flow.openInterviewForm': 'Открываю форму интервью.',
  'flow.templateOutOfRange':
    'Шаблон {index} отсутствует в списке. Выберите номер от 1 до {max} или напишите «create my own».',
  'flow.templateNoQuestions':
    'В шаблоне «{templateName}» нет доступных вопросов. Попробуйте другой шаблон или напишите «create my own».',
  'flow.createInterviewConfirm':
    'Создать интервью для {candidateName} по шаблону «{templateName}» ({questionCount} вопросов)? Ответьте yes для подтверждения.',
  'flow.noTemplates':
    'Шаблоны для {position} не найдены. Напишите «create my own», чтобы открыть форму интервью.',
  'flow.templatesFound':
    'Найдено шаблонов для {position}: {count}. Выберите номер или напишите «create my own».',
  'flow.pickCandidate':
    'Выберите зарегистрированного кандидата или введите новое имя.',
  'flow.pickCandidateFromList':
    'Выберите зарегистрированного кандидата из списка или введите новое имя.',
  'flow.candidatesMatching':
    'Найдено зарегистрированных кандидатов по запросу «{name}»: {count}. Выберите одного или введите новое имя.',
  'flow.candidateNotInList':
    'Этого кандидата нет в списке. Выберите одного из списка или введите новое имя.',
  'flow.confirmRegisteredCandidate':
    'Использовать зарегистрированного кандидата {name} ({email})? Ответьте yes или no.',
  'flow.similarQuestions':
    'Найдено похожих вопросов (≥80%): {count}. Всё равно добавить «{questionName}»? Ответьте yes, чтобы продолжить, или no для отмены.',
  'flow.similarQuestionsRetry':
    '{previousMessage} Ответьте yes, чтобы повторить, или no/cancel для отмены.',
  'flow.similarQuestionsReprompt':
    'Ответьте yes, чтобы всё равно добавить вопрос, или no/cancel для отмены.',
  'flow.createQuestionConfirm':
    'Создать вопрос «{questionName}» с AI-подсказками? Ответьте yes для подтверждения.',
  'flow.questionDraftFailed':
    'Не удалось сгенерировать AI-подсказки для этого вопроса.',
  'flow.questionDraftGenerationFailed':
    'Не удалось сгенерировать черновик вопроса. Попробуйте снова или создайте вопрос вручную.',
  'flow.assignInterviewPrompt': 'Какое интервью назначить?',
  'flow.assignHrPrompt': 'Какого HR-ревьюера назначить?',
  'flow.assignInterviewAmbiguous':
    'Не удалось однозначно определить интервью, выберите из списка',
  'flow.assignHrAmbiguous':
    'Не удалось однозначно определить HR-ревьюера, выберите из списка',
  'flow.assignHrConfirm':
    'Назначить {interviewLabel} на {hrName}? Ответьте yes для подтверждения.',
  'flow.noUnassignedInterviews': 'Нет интервью без назначенного ревьюера.',

  'locale.unsupported':
    '«{token}» — неподдерживаемая локаль. Поддерживаются: en, be, ru, pl.',
  'locale.switchHint':
    'Напишите «switch locale to ru» (поддерживаются: en, be, ru, pl).',
  'locale.switched': 'Язык приложения переключён на {locale}.',

  'candidate.status.readyToStart': 'готово к началу',
  'candidate.status.inProgress': 'в процессе',
  'candidate.status.submittedReview': 'отправлено и на проверке',
  'candidate.status.reviewComplete': 'ревью завершено',
  'candidate.status.submittedWaiting': 'отправлено, ожидает обратной связи',
  'candidate.status.failed': 'не пройдено',
  'candidate.statusResponse':
    'Ваше интервью на позицию {position}: {statusLabel}.',
  'candidate.statusResponseSchedule':
    'Ваше интервью на позицию {position}: {statusLabel}. Создано {createdDate}. Приложение пока не хранит отдельное время или место интервью — используйте ссылку на интервью, когда статус pending или in progress.',
  'candidate.reviewed':
    'Ваше интервью на позицию {position} проверено{outcome}.',
  'candidate.submittedNotReviewed':
    'Ваше интервью на позицию {position} отправлено, но ещё не проверено.',
  'candidate.notReviewed':
    'Ваше интервью на позицию {position} ещё не проверено.',
  'candidate.ambiguousPosition':
    'Найдено несколько интервью по этой позиции: {options}. Уточните точное название роли.',
  'candidate.unknownPosition':
    'Не удалось найти интервью для «{query}». Ваши интервью: {available}.',
  'candidate.noInterviews': 'У вас пока нет интервью.',
  'candidate.noActiveInterviews': 'У вас нет интервью, ожидающих завершения.',
  'candidate.oneActiveInterview':
    'У вас 1 интервью для завершения: {description}.',
  'candidate.multipleActiveInterviews':
    'У вас {count} интервью для завершения: {descriptions}.',
  'candidate.allInterviews': 'У вас {count} интервью: {summary}.',
  'candidate.onlyOwnReview':
    'Вы можете проверять состояние ревью только своих интервью.',

  'executed.assignedHr': 'Назначено: {interviewLabel} → {hrName}.',
  'refused.assignHrFailed':
    'Не удалось назначить HR-ревьюера. Проверьте id интервью и ревьюера и попробуйте снова.',
  'executed.questionCreated': 'Создан вопрос «{questionText}».',
  'refused.questionCreateFailed':
    'Не удалось создать вопрос. Попробуйте снова.',
  'refused.cannotCreateQuestionsPermission':
    'Не могу создать недостающие вопросы: у вашего пользователя нет права questions:create.',
  'refused.cannotCreateInterviewPermission':
    'Не могу создать интервью: у вашего пользователя нет права interviews:create.{rollbackNote}',
  'refused.questionsFailedPartial':
    'Создание вопросов прервано. Новые вопросы из этой попытки откатаны; интервью не создано.',
  'refused.questionsFailed':
    'При создании вопросов произошла ошибка. Вопросы и интервью не созданы; начните заново.',
  'executed.questionsOnlyReady':
    'Новые вопросы не потребовались. Предложенный набор готов.',
  'executed.questionsCreated':
    'Создано недостающих вопросов: {count}. Пришлите имя кандидата, когда захотите создать интервью.',
  'executed.interviewCreated':
    'Интервью создано для {candidateName}. Прикреплено вопросов: {questionCount}.',
  'refused.interviewCreateFailed':
    'Не удалось создать интервью. Новые вопросы из этой попытки откатаны; начните заново.',

  'questionPlan.allMatched':
    'Все предложенные вопросы уже имеют близкие совпадения в банке вопросов.',
  'questionPlan.foundMatches':
    'Найдено близких совпадений: {existingCount}; нужно создать вопросов: {missingCount}.',
  'questionPlan.noCreatePermission':
    'Найдено близких совпадений: {existingCount}, пробелов: {missingCount}, но ваш пользователь не может создавать вопросы.',
  'questionPlan.confirmWithInterview':
    'Подтвердите — я создам недостающие вопросы, затем интервью для {candidateName}.',
  'questionPlan.confirmQuestionsOnly':
    'Подтвердите — я создам недостающие вопросы. Пришлите имя кандидата, когда захотите создать интервью.',
  'questionPlan.noInterviewPermission':
    'Ваш пользователь не может создавать интервью, поэтому я могу только подготовить набор вопросов.',
};

const BE_MESSAGES: MessageCatalog = {
  outOfScope:
    'Я магу дапамагчы з інтэрв’ю, падліком пытанняў, ацэнкамі, удзельнікамі каманды, зводкамі актыўнасці, прызначэннямі і наладай пытанняў у гэтай праграме.',
  outOfScopeCandidate:
    'Я магу дапамагчы са статусам вашага інтэрв’ю, абнаўленнямі па аглядзе і незавершанымі інтэрв’ю.',
  disabledGlobal: 'Рэкруцерскі асистент адключаны ў гэтай асяроддзі.',
  disabledForRole:
    'Рэкруцерскі асистент недаступны для вашай ролі ў гэтай асяроддзі.',
  newChatWelcome:
    'Пачата новая размова. Чым дапамагчы з інтэрв’ю, пытаннямі або прызначэннямі?',
  newChatWelcomeCandidate:
    'Пачата новая размова. Запытайце пра статус інтэрв’ю, гатоўнасць зваротнай сувязі або інтэрв’ю, якія яшчэ трэба прайсці.',

  cancelled: 'Скасавана. Змены не былі ўнесены.',
  confirmationExpired:
    'Гэтае пацверджанне састарэла, ужо было выкарыстана або не належыць вашаму акаўнту.',
  confirmationApplyFailed:
    'Гэтае пацверджанне не ўдалося прымяніць. Праверце спіс пытанняў і паспрабуйце зноў.',

  'denied.listInterviews': 'У вас няма правоў на прагляд спісу інтэрв’ю.',
  'denied.readQuestions': 'У вас няма правоў на чытанне банка пытанняў.',
  'denied.readAssessments': 'У вас няма правоў на прагляд ацэнак.',
  'denied.summarizeActivity':
    'У вас няма правоў на фарміраванне зводкі актыўнасці па інтэрв’ю.',
  'denied.listTeam': 'У вас няма правоў на прагляд удзельнікаў каманды.',
  'denied.listHrs': 'Толькі адміністратары могуць праглядаць HR-аглядачоў.',
  'denied.lookupStatus': 'У вас няма правоў на пошук статусу інтэрв’ю.',
  'denied.checkReview': 'У вас няма правоў на праверку стану агляду.',
  'denied.assignHr': 'Толькі адміністратары могуць прызначаць HR-аглядачоў.',
  'denied.createQuestions': 'У вас няма правоў на стварэнне пытанняў.',
  'denied.createInterviews': 'У вас няма правоў на стварэнне інтэрв’ю.',
  'denied.readQuestionsForPrep':
    'У вас няма правоў на чытанне банка пытанняў для падрыхтоўкі інтэрв’ю.',
  'denied.candidatesOnly': 'Гэтае пытанне прызначана толькі для кандыдатаў.',
  'denied.candidateOwnReviewOnly':
    'Вы можаце правяраць стан агляду толькі сваіх інтэрв’ю.',

  'answered.noInterviewsReadyForReview':
    'Няма завершаных інтэрв’ю, гатовых да вашага агляду.',
  'answered.noInterviewsMatched': 'Жоднае інтэрв’ю не адпавядае запыту.',
  'answered.interviewsFound': 'Знойдзена інтэрв’ю: {total}. Паказана: {count}.',
  'answered.questionsCountFiltered':
    '{total} пытання(ў) адпавядаюць вашым фільтрам. Адкрыйце банк пытанняў для прагляду.',
  'answered.questionsCountTotal':
    'Усяго ў вас {total} пытання(ў). Адкрыйце банк пытанняў для прагляду.',
  'answered.assessmentsCountFiltered':
    '{total} ацэнак адпавядаюць вашым фільтрам.{truncatedNote} Адкрыйце старонку ацэнак для прагляду.',
  'answered.assessmentsCountTotal':
    'Усяго ў вас {total} ацэнак.{truncatedNote} Адкрыйце старонку ацэнак для прагляду.',
  'answered.assessmentsTruncatedNote':
    ' (падлік па {scanLimit} апошнім абноўленым інтэрв’ю; адкрыйце старонку ацэнак для поўнага спісу)',
  'answered.activitySummary':
    'У вашай арганізацыі {total} інтэрв’ю: {active} актыўных, {completed} завершаных, {failed} невдалі.',
  'answered.noTeamMembers': 'Удзельнікі каманды не знойдзены.',
  'answered.teamMembersListed':
    '{summaryLine}Паказана ўдзельнікаў каманды{roleLabel}: {count}.',
  'answered.noHrs': 'HR-аглядачы недаступныя.',
  'answered.hrsFound': 'Знойдзена HR-аглядачоў: {count}.',
  'answered.interviewNotFound':
    'Не ўдалося знайсці адно інтэрв’ю. Пакажыце id інтэрв’ю або імя кандыдата.',
  'answered.interviewStatus':
    'Інтэрв’ю кандыдата {candidateName} на пазіцыю {position}: {status}.',
  'answered.interviewReviewed':
    'Інтэрв’ю кандыдата {candidateName} праверана{outcome}.',
  'answered.interviewNotReviewed':
    'Інтэрв’ю кандыдата {candidateName} яшчэ не праверана.',

  'flow.askQuestionName': 'Як назваць пытанне?',
  'flow.askPosition': 'Для якой пазіцыі гэта інтэрв’ю?',
  'flow.askCandidateName': 'Як клічуць кандыдата?',
  'flow.pickTemplate': 'Выберыце нумар са спісу або напішыце «create my own».',
  'flow.openInterviewForm': 'Адкрываю форму інтэрв’ю.',
  'flow.templateOutOfRange':
    'Шаблон {index} адсутнічае ў спісе. Выберыце нумар ад 1 да {max} або напішыце «create my own».',
  'flow.templateNoQuestions':
    'У шаблоне «{templateName}» няма даступных пытанняў. Паспрабуйце іншы шаблон або напішыце «create my own».',
  'flow.createInterviewConfirm':
    'Стварыць інтэрв’ю для {candidateName} па шаблоне «{templateName}» ({questionCount} пытанняў)? Адкажыце yes для пацверджання.',
  'flow.noTemplates':
    'Шаблоны для {position} не знойдзены. Напішыце «create my own», каб адкрыць форму інтэрв’ю.',
  'flow.templatesFound':
    'Знойдзена шаблонаў для {position}: {count}. Выберыце нумар або напішыце «create my own».',
  'flow.pickCandidate':
    'Выберыце зарэгістраванага кандыдата або ўвядзіце новае імя.',
  'flow.pickCandidateFromList':
    'Выберыце зарэгістраванага кандыдата са спісу або ўвядзіце новае імя.',
  'flow.candidatesMatching':
    'Знойдзена зарэгістраваных кандыдатаў па запыце «{name}»: {count}. Выберыце аднаго або ўвядзіце новае імя.',
  'flow.candidateNotInList':
    'Гэтага кандыдата няма ў спісе. Выберыце аднаго са спісу або ўвядзіце новае імя.',
  'flow.confirmRegisteredCandidate':
    'Выкарыстаць зарэгістраванага кандыдата {name} ({email})? Адкажыце yes або no.',
  'flow.similarQuestions':
    'Знойдзена падобных пытанняў (≥80%): {count}. Усё роўна дадаць «{questionName}»? Адкажыце yes, каб працягнуць, або no для скасавання.',
  'flow.similarQuestionsRetry':
    '{previousMessage} Адкажыце yes, каб паўтарыць, або no/cancel для скасавання.',
  'flow.similarQuestionsReprompt':
    'Адкажыце yes, каб усё роўна дадаць пытанне, або no/cancel для скасавання.',
  'flow.createQuestionConfirm':
    'Стварыць пытанне «{questionName}» з AI-падказкамі? Адкажыце yes для пацверджання.',
  'flow.questionDraftFailed':
    'Не ўдалося згенераваць AI-падказкі для гэтага пытання.',
  'flow.questionDraftGenerationFailed':
    'Не ўдалося згенераваць праект пытання. Паспрабуйце зноў або стварыце пытанне ўручную.',
  'flow.assignInterviewPrompt': 'Якое інтэрв’ю прызначыць?',
  'flow.assignHrPrompt': 'Якога HR-аглядача прызначыць?',
  'flow.assignInterviewAmbiguous':
    'Не ўдалося адназначна вызначыць інтэрв’ю, выберыце са спісу',
  'flow.assignHrAmbiguous':
    'Не ўдалося адназначна вызначыць HR-аглядача, выберыце са спісу',
  'flow.assignHrConfirm':
    'Прызначыць {interviewLabel} на {hrName}? Адкажыце yes для пацверджання.',
  'flow.noUnassignedInterviews': 'Няма інтэрв’ю без прызначанага аглядача.',

  'locale.unsupported':
    '«{token}» — непадтрымліваемая мова. Падтрымліваюцца: en, be, ru, pl.',
  'locale.switchHint':
    'Напішыце «switch locale to ru» (падтрымліваюцца: en, be, ru, pl).',
  'locale.switched': 'Мова праграмы пераключана на {locale}.',

  'candidate.status.readyToStart': 'гатова да пачатку',
  'candidate.status.inProgress': 'у працэсе',
  'candidate.status.submittedReview': 'адправлена і на праверцы',
  'candidate.status.reviewComplete': 'агляд завершаны',
  'candidate.status.submittedWaiting': 'адправлена, чакае зваротнай сувязі',
  'candidate.status.failed': 'не пройдзена',
  'candidate.statusResponse':
    'Ваша інтэрв’ю на пазіцыю {position}: {statusLabel}.',
  'candidate.statusResponseSchedule':
    'Ваша інтэрв’ю на пазіцыю {position}: {statusLabel}. Створана {createdDate}. Праграма пакуль не захоўвае асобны час або месца інтэрв’ю — скарыстайцеся спасылкай на інтэрв’ю, калі статус pending або in progress.',
  'candidate.reviewed':
    'Ваша інтэрв’ю на пазіцыю {position} праверана{outcome}.',
  'candidate.submittedNotReviewed':
    'Ваша інтэрв’ю на пазіцыю {position} адправлена, але яшчэ не праверана.',
  'candidate.notReviewed':
    'Ваша інтэрв’ю на пазіцыю {position} яшчэ не праверана.',
  'candidate.ambiguousPosition':
    'Знойдзена некалькі інтэрв’ю па гэтай пазіцыі: {options}. Уточніце дакладную назву ролі.',
  'candidate.unknownPosition':
    'Не ўдалося знайсці інтэрв’ю для «{query}». Вашы інтэрв’ю: {available}.',
  'candidate.noInterviews': 'У вас пакуль няма інтэрв’ю.',
  'candidate.noActiveInterviews':
    'У вас няма інтэрв’ю, якія чакаюць завершэння.',
  'candidate.oneActiveInterview':
    'У вас 1 інтэрв’ю для завершэння: {description}.',
  'candidate.multipleActiveInterviews':
    'У вас {count} інтэрв’ю для завершэння: {descriptions}.',
  'candidate.allInterviews': 'У вас {count} інтэрв’ю: {summary}.',
  'candidate.onlyOwnReview':
    'Вы можаце правяраць стан агляду толькі сваіх інтэрв’ю.',

  'executed.assignedHr': 'Прызначана: {interviewLabel} → {hrName}.',
  'refused.assignHrFailed':
    'Не ўдалося прызначыць HR-аглядача. Праверце id інтэрв’ю і аглядача і паспрабуйце зноў.',
  'executed.questionCreated': 'Створана пытанне «{questionText}».',
  'refused.questionCreateFailed':
    'Не ўдалося стварыць пытанне. Паспрабуйце зноў.',
  'refused.cannotCreateQuestionsPermission':
    'Не магу стварыць нестаючыя пытанні: у вашага карыстальніка няма права questions:create.',
  'refused.cannotCreateInterviewPermission':
    'Не магу стварыць інтэрв’ю: у вашага карыстальніка няма права interviews:create.{rollbackNote}',
  'refused.questionsFailedPartial':
    'Стварэнне пытанняў перарвана. Новыя пытанні з гэтай спробы адкатаны; інтэрв’ю не створана.',
  'refused.questionsFailed':
    'Пры стварэнні пытанняў адбылася памылка. Пытанні і інтэрв’ю не створаны; пачніце спачатку.',
  'executed.questionsOnlyReady':
    'Новыя пытанні не спатрэбіліся. Прапанаваны набор гатовы.',
  'executed.questionsCreated':
    'Створана нестаючых пытанняў: {count}. Прышліце імя кандыдата, калі захочаце стварыць інтэрв’ю.',
  'executed.interviewCreated':
    'Інтэрв’ю створана для {candidateName}. Прымацавана пытанняў: {questionCount}.',
  'refused.interviewCreateFailed':
    'Не ўдалося стварыць інтэрв’ю. Новыя пытанні з гэтай спробы адкатаны; пачніце спачатку.',

  'questionPlan.allMatched':
    'Усе прапанаваныя пытанні ўжо маюць блізкія супадзенні ў банку пытанняў.',
  'questionPlan.foundMatches':
    'Знойдзена блізкіх супадзенняў: {existingCount}; трэба стварыць пытанняў: {missingCount}.',
  'questionPlan.noCreatePermission':
    'Знойдзена блізкіх супадзенняў: {existingCount}, прабелаў: {missingCount}, але ваш карыстальнік не можа ствараць пытанні.',
  'questionPlan.confirmWithInterview':
    'Пацвердзіце — я ствару нестаючыя пытанні, затым інтэрв’ю для {candidateName}.',
  'questionPlan.confirmQuestionsOnly':
    'Пацвердзіце — я ствару нестаючыя пытанні. Прышліце імя кандыдата, калі захочаце стварыць інтэрв’ю.',
  'questionPlan.noInterviewPermission':
    'Ваш карыстальнік не можа ствараць інтэрв’ю, таму я магу толькі падрыхтаваць набор пытанняў.',
};

const PL_MESSAGES: MessageCatalog = {
  outOfScope:
    'Mogę pomóc z rozmowami kwalifikacyjnymi, liczbą pytań, ocenami, członkami zespołu, podsumowaniami aktywności, przypisaniami i konfiguracją pytań w tej aplikacji.',
  outOfScopeCandidate:
    'Mogę pomóc ze statusem rozmowy, aktualizacjami recenzji i niedokończonymi rozmowami.',
  disabledGlobal: 'Asystent rekrutera jest wyłączony w tym środowisku.',
  disabledForRole:
    'Asystent rekrutera nie jest dostępny dla Twojej roli w tym środowisku.',
  newChatWelcome:
    'Rozpoczęto nową rozmowę. W czym mogę pomóc w sprawie rozmów, pytań lub przypisań?',
  newChatWelcomeCandidate:
    'Rozpoczęto nową rozmowę. Zapytaj o status rozmowy, gotowość feedbacku lub rozmowy, które musisz jeszcze ukończyć.',

  cancelled: 'Anulowano. Nie wprowadzono żadnych zmian.',
  confirmationExpired:
    'To potwierdzenie wygasło, zostało już użyte lub nie należy do Twojego konta.',
  confirmationApplyFailed:
    'Nie udało się zastosować tego potwierdzenia. Sprawdź listę pytań i spróbuj ponownie.',

  'denied.listInterviews': 'Nie masz uprawnień do wyświetlania listy rozmów.',
  'denied.readQuestions': 'Nie masz uprawnień do odczytu banku pytań.',
  'denied.readAssessments': 'Nie masz uprawnień do odczytu ocen.',
  'denied.summarizeActivity':
    'Nie masz uprawnień do podsumowania aktywności rozmów.',
  'denied.listTeam': 'Nie masz uprawnień do wyświetlania członków zespołu.',
  'denied.listHrs': 'Tylko administratorzy mogą wyświetlać recenzentów HR.',
  'denied.lookupStatus': 'Nie masz uprawnień do wyszukiwania statusu rozmowy.',
  'denied.checkReview': 'Nie masz uprawnień do sprawdzania stanu recenzji.',
  'denied.assignHr': 'Tylko administratorzy mogą przypisywać recenzentów HR.',
  'denied.createQuestions': 'Nie masz uprawnień do tworzenia pytań.',
  'denied.createInterviews': 'Nie masz uprawnień do tworzenia rozmów.',
  'denied.readQuestionsForPrep':
    'Nie masz uprawnień do odczytu banku pytań w celu przygotowania rozmowy.',
  'denied.candidatesOnly': 'To pytanie jest przeznaczone tylko dla kandydatów.',
  'denied.candidateOwnReviewOnly':
    'Możesz sprawdzać stan recenzji tylko własnych rozmów.',

  'answered.noInterviewsReadyForReview':
    'Brak ukończonych rozmów gotowych do Twojej recenzji.',
  'answered.noInterviewsMatched': 'Żadna rozmowa nie pasuje do zapytania.',
  'answered.interviewsFound':
    'Znaleziono rozmów: {total}. Wyświetlono: {count}.',
  'answered.questionsCountFiltered':
    '{total} pytań pasuje do filtrów. Otwórz bank pytań, aby je przeglądać.',
  'answered.questionsCountTotal':
    'Masz łącznie {total} pytań. Otwórz bank pytań, aby je przeglądać.',
  'answered.assessmentsCountFiltered':
    '{total} ocen pasuje do filtrów.{truncatedNote} Otwórz stronę ocen, aby je przeglądać.',
  'answered.assessmentsCountTotal':
    'Masz łącznie {total} ocen.{truncatedNote} Otwórz stronę ocen, aby je przeglądać.',
  'answered.assessmentsTruncatedNote':
    ' (liczba na podstawie {scanLimit} ostatnio zaktualizowanych rozmów; otwórz stronę ocen, aby zobaczyć pełną listę)',
  'answered.activitySummary':
    'Twoja organizacja ma {total} rozmów: {active} aktywnych, {completed} ukończonych, {failed} nieudanych.',
  'answered.noTeamMembers': 'Nie znaleziono członków zespołu.',
  'answered.teamMembersListed':
    '{summaryLine}Wyświetlono {count} członków zespołu{roleLabel}.',
  'answered.noHrs': 'Brak dostępnych recenzentów HR.',
  'answered.hrsFound': 'Znaleziono recenzentów HR: {count}.',
  'answered.interviewNotFound':
    'Nie udało się znaleźć jednoznacznej rozmowy. Podaj id rozmowy lub imię kandydata.',
  'answered.interviewStatus':
    'Rozmowa kandydata {candidateName} na stanowisko {position}: {status}.',
  'answered.interviewReviewed':
    'Rozmowa kandydata {candidateName} została oceniona{outcome}.',
  'answered.interviewNotReviewed':
    'Rozmowa kandydata {candidateName} nie została jeszcze oceniona.',

  'flow.askQuestionName': 'Jak nazwać pytanie?',
  'flow.askPosition': 'Na jakie stanowisko jest ta rozmowa?',
  'flow.askCandidateName': 'Jak nazywa się kandydat?',
  'flow.pickTemplate': 'Wybierz numer z listy lub napisz „create my own”.',
  'flow.openInterviewForm': 'Otwieram formularz rozmowy.',
  'flow.templateOutOfRange':
    'Szablon {index} nie jest na liście. Wybierz numer od 1 do {max} lub napisz „create my own”.',
  'flow.templateNoQuestions':
    'Szablon „{templateName}” nie ma dostępnych pytań. Wybierz inny szablon lub napisz „create my own”.',
  'flow.createInterviewConfirm':
    'Utworzyć rozmowę dla {candidateName} na podstawie szablonu „{templateName}” ({questionCount} pytań)? Odpowiedz yes, aby potwierdzić.',
  'flow.noTemplates':
    'Nie znaleziono szablonów dla {position}. Napisz „create my own”, aby otworzyć formularz rozmowy.',
  'flow.templatesFound':
    'Znaleziono szablonów dla {position}: {count}. Wybierz numer lub napisz „create my own”.',
  'flow.pickCandidate':
    'Wybierz zarejestrowanego kandydata lub wpisz nowe imię.',
  'flow.pickCandidateFromList':
    'Wybierz zarejestrowanego kandydata z listy lub wpisz nowe imię.',
  'flow.candidatesMatching':
    'Znaleziono zarejestrowanych kandydatów pasujących do „{name}”: {count}. Wybierz jednego lub wpisz nowe imię.',
  'flow.candidateNotInList':
    'Tego kandydata nie ma na liście. Wybierz jednego z listy lub wpisz nowe imię.',
  'flow.confirmRegisteredCandidate':
    'Użyć zarejestrowanego kandydata {name} ({email})? Odpowiedz yes lub no.',
  'flow.similarQuestions':
    'Znaleziono podobnych pytań (≥80%): {count}. Mimo to dodać „{questionName}”? Odpowiedz yes, aby kontynuować, lub no, aby anulować.',
  'flow.similarQuestionsRetry':
    '{previousMessage} Odpowiedz yes, aby spróbować ponownie, lub no/cancel, aby anulować.',
  'flow.similarQuestionsReprompt':
    'Odpowiedz yes, aby mimo to dodać pytanie, lub no/cancel, aby anulować.',
  'flow.createQuestionConfirm':
    'Utworzyć pytanie „{questionName}” z sugestiami AI? Odpowiedz yes, aby potwierdzić.',
  'flow.questionDraftFailed':
    'Nie udało się wygenerować sugestii AI dla tego pytania.',
  'flow.questionDraftGenerationFailed':
    'Nie udało się wygenerować szkicu pytania. Spróbuj ponownie lub utwórz pytanie ręcznie.',
  'flow.assignInterviewPrompt': 'Którą rozmowę przypisać?',
  'flow.assignHrPrompt': 'Którego recenzenta HR przypisać?',
  'flow.assignInterviewAmbiguous':
    'Nie udało się jednoznacznie określić rozmowy, wybierz z listy',
  'flow.assignHrAmbiguous':
    'Nie udało się jednoznacznie określić recenzenta HR, wybierz z listy',
  'flow.assignHrConfirm':
    'Przypisać {interviewLabel} do {hrName}? Odpowiedz yes, aby potwierdzić.',
  'flow.noUnassignedInterviews': 'Brak rozmów bez przypisanego recenzenta.',

  'locale.unsupported':
    '„{token}” nie jest obsługiwaną lokalizacją. Obsługiwane: en, be, ru, pl.',
  'locale.switchHint':
    'Napisz „switch locale to ru” (obsługiwane: en, be, ru, pl).',
  'locale.switched': 'Język aplikacji przełączono na {locale}.',

  'candidate.status.readyToStart': 'gotowa do rozpoczęcia',
  'candidate.status.inProgress': 'w trakcie',
  'candidate.status.submittedReview': 'wysłana i w recenzji',
  'candidate.status.reviewComplete': 'recenzja zakończona',
  'candidate.status.submittedWaiting': 'wysłana, oczekuje na feedback',
  'candidate.status.failed': 'nieudana',
  'candidate.statusResponse':
    'Twoja rozmowa na stanowisko {position}: {statusLabel}.',
  'candidate.statusResponseSchedule':
    'Twoja rozmowa na stanowisko {position}: {statusLabel}. Utworzono {createdDate}. Aplikacja nie przechowuje jeszcze osobnego terminu ani miejsca rozmowy — użyj linku do rozmowy, gdy status to pending lub in progress.',
  'candidate.reviewed':
    'Twoja rozmowa na stanowisko {position} została oceniona{outcome}.',
  'candidate.submittedNotReviewed':
    'Twoja rozmowa na stanowisko {position} została wysłana, ale nie została jeszcze oceniona.',
  'candidate.notReviewed':
    'Twoja rozmowa na stanowisko {position} nie została jeszcze oceniona.',
  'candidate.ambiguousPosition':
    'Znalazłem wiele rozmów pasujących do tego stanowiska: {options}. Podaj dokładną nazwę roli.',
  'candidate.unknownPosition':
    'Nie znalazłem rozmowy dla „{query}”. Twoje rozmowy: {available}.',
  'candidate.noInterviews': 'Nie masz jeszcze żadnych rozmów.',
  'candidate.noActiveInterviews': 'Nie masz rozmów oczekujących na ukończenie.',
  'candidate.oneActiveInterview':
    'Masz 1 rozmowę do ukończenia: {description}.',
  'candidate.multipleActiveInterviews':
    'Masz {count} rozmów do ukończenia: {descriptions}.',
  'candidate.allInterviews': 'Masz {count} rozmów: {summary}.',
  'candidate.onlyOwnReview':
    'Możesz sprawdzać stan recenzji tylko własnych rozmów.',

  'executed.assignedHr': 'Przypisano {interviewLabel} do {hrName}.',
  'refused.assignHrFailed':
    'Nie udało się przypisać recenzenta HR. Sprawdź id rozmowy i recenzenta i spróbuj ponownie.',
  'executed.questionCreated': 'Utworzono pytanie „{questionText}”.',
  'refused.questionCreateFailed':
    'Nie udało się utworzyć pytania. Spróbuj ponownie.',
  'refused.cannotCreateQuestionsPermission':
    'Nie mogę utworzyć brakujących pytań, ponieważ Twój użytkownik nie ma uprawnienia questions:create.',
  'refused.cannotCreateInterviewPermission':
    'Nie mogę utworzyć rozmowy, ponieważ Twój użytkownik nie ma uprawnienia interviews:create.{rollbackNote}',
  'refused.questionsFailedPartial':
    'Tworzenie pytań przerwano. Nowe pytania z tej próby zostały wycofane; rozmowa nie została utworzona.',
  'refused.questionsFailed':
    'Coś poszło nie tak podczas tworzenia pytań. Nie utworzono pytań ani rozmowy; zacznij od nowa.',
  'executed.questionsOnlyReady':
    'Nowe pytania nie były potrzebne. Sugerowany zestaw jest gotowy.',
  'executed.questionsCreated':
    'Utworzono brakujących pytań: {count}. Podaj imię kandydata, gdy chcesz utworzyć rozmowę.',
  'executed.interviewCreated':
    'Utworzono rozmowę dla {candidateName}. Dołączono pytań: {questionCount}.',
  'refused.interviewCreateFailed':
    'Nie udało się utworzyć rozmowy. Nowe pytania z tej próby zostały wycofane; zacznij od nowa.',

  'questionPlan.allMatched':
    'Wszystkie sugerowane pytania mają już bliskie dopasowania w banku pytań.',
  'questionPlan.foundMatches':
    'Znalazłem {existingCount} bliskich dopasowań; trzeba utworzyć pytań: {missingCount}.',
  'questionPlan.noCreatePermission':
    'Znalazłem {existingCount} bliskich dopasowań i {missingCount} luk, ale Twój użytkownik nie może tworzyć pytań.',
  'questionPlan.confirmWithInterview':
    'Potwierdź — utworzę brakujące pytania, a następnie rozmowę dla {candidateName}.',
  'questionPlan.confirmQuestionsOnly':
    'Potwierdź — utworzę brakujące pytania. Podaj imię kandydata, gdy chcesz, abym utworzył rozmowę.',
  'questionPlan.noInterviewPermission':
    'Twój użytkownik nie może tworzyć rozmów, więc mogę tylko przygotować zestaw pytań.',
};

const MESSAGES: Record<Locale, MessageCatalog> = {
  en: EN_MESSAGES,
  ru: RU_MESSAGES,
  be: BE_MESSAGES,
  pl: PL_MESSAGES,
};

function replaceParams(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value !== undefined && value !== null ? String(value) : match;
  });
}

export function assistantMessage(
  locale: Locale,
  key: AssistantMessageKey,
  params?: Record<string, string | number>,
): string {
  const template = MESSAGES[locale]?.[key] ?? EN_MESSAGES[key];
  return replaceParams(template, params);
}
