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

function questionEquals(
  left: RecruiterAssistantSuggestedQuestionDto,
  right: RecruiterAssistantSuggestedQuestionDto,
): boolean {
  return (
    left.key === right.key && JSON.stringify(left) === JSON.stringify(right)
  );
}

export function applyCreatePendingActionQuestionOverride(
  stored: RecruiterAssistantCreatePendingActionDto,
  override: RecruiterAssistantCreatePendingActionDto,
): RecruiterAssistantCreatePendingActionDto | null {
  if (stored.type !== override.type) {
    return null;
  }

  if (
    stored.position !== override.position ||
    stored.candidateName !== override.candidateName ||
    stored.candidateEmail !== override.candidateEmail ||
    stored.interviewLocale !== override.interviewLocale
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

  for (const question of override.questions) {
    const original = storedByKey.get(question.key);
    if (!original || !questionEquals(original, question)) {
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
