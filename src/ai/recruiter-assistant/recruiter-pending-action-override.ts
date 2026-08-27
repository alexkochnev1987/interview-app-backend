import {
  RecruiterAssistantCreatePendingActionDto,
  RecruiterAssistantPendingActionDto,
  RecruiterAssistantSuggestedQuestionDto,
} from './dto/recruiter-assistant.dto';

function isCreatePendingAction(
  action: RecruiterAssistantPendingActionDto,
): action is RecruiterAssistantCreatePendingActionDto {
  return (
    action.type === 'create_interview' || action.type === 'create_questions'
  );
}

function optionalStringEquals(
  left: string | undefined,
  right: string | undefined,
): boolean {
  return (left ?? '') === (right ?? '');
}

function optionalLocaleEquals(
  left: RecruiterAssistantCreatePendingActionDto['interviewLocale'],
  right: RecruiterAssistantCreatePendingActionDto['interviewLocale'],
): boolean {
  return (left ?? undefined) === (right ?? undefined);
}

export function applyCreatePendingActionQuestionOverride(
  stored: RecruiterAssistantCreatePendingActionDto,
  override: RecruiterAssistantCreatePendingActionDto,
): RecruiterAssistantCreatePendingActionDto | null {
  if (stored.type !== override.type) {
    return null;
  }

  if (
    !optionalStringEquals(stored.position, override.position) ||
    !optionalStringEquals(stored.candidateName, override.candidateName) ||
    !optionalStringEquals(stored.candidateEmail, override.candidateEmail) ||
    !optionalLocaleEquals(stored.interviewLocale, override.interviewLocale)
  ) {
    return null;
  }

  if (
    override.questions.length === 0 ||
    override.questions.length > stored.questions.length
  ) {
    return null;
  }

  const storedByKey = new Map(
    stored.questions.map((question) => [question.key, question]),
  );
  const questions: RecruiterAssistantSuggestedQuestionDto[] = [];

  const seenKeys = new Set<string>();

  for (const question of override.questions) {
    if (seenKeys.has(question.key)) {
      return null;
    }
    seenKeys.add(question.key);

    const original = storedByKey.get(question.key);
    if (!original) {
      return null;
    }
    questions.push(original);
  }

  return {
    ...stored,
    questions,
  };
}

export function applyPendingActionOverride(
  stored: RecruiterAssistantPendingActionDto,
  override: RecruiterAssistantPendingActionDto,
): RecruiterAssistantPendingActionDto | null {
  if (!isCreatePendingAction(stored) || !isCreatePendingAction(override)) {
    return null;
  }

  return applyCreatePendingActionQuestionOverride(stored, override);
}
