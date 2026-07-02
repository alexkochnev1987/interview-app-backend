import { QuestionCore } from './interfaces/question.interface';
import { ResolveQuestionInput } from './resolve-question';

export function toResolveQuestionInput(question: QuestionCore): ResolveQuestionInput {
  return {
    primaryLocale: question.primaryLocale,
    translations: question.translations,
    questionText: question.questionText,
    followUpQuestions: question.followUpQuestions,
    expectedConcepts: question.expectedConcepts,
    redFlags: question.redFlags,
    sampleGoodAnswer: question.sampleGoodAnswer,
  };
}
