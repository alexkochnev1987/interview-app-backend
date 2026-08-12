import { Injectable } from '@nestjs/common';

import { Locale } from '../../locale/locale.constants';
import { SimilarQuestionMatch } from '../../question/interfaces/question.interface';
import { QuestionService } from '../../question/question.service';
import { RecruiterAssistantSuggestedQuestionDto } from './dto/recruiter-assistant.dto';
import { ActingUser } from './recruiter-assistant.types';

const SIMILARITY_ACCEPTANCE_SCORE = 0.72;
const SIMILARITY_LIST_THRESHOLD = 0.8;

@Injectable()
export class RecruiterQuestionMatcherService {
  constructor(private readonly questionService: QuestionService) {}

  async resolveExistingQuestions(
    questions: RecruiterAssistantSuggestedQuestionDto[],
    user: ActingUser,
    locale: Locale,
  ): Promise<RecruiterAssistantSuggestedQuestionDto[]> {
    return Promise.all(
      questions.map(async (question) => {
        const match = await this.findBestMatch(question, user.demo, locale);
        if (!match || match.score < SIMILARITY_ACCEPTANCE_SCORE) {
          return { ...question, needsCreation: true };
        }
        return {
          ...question,
          existingQuestionId: match.question.id,
          existingQuestionText: match.question.questionText,
          needsCreation: false,
        };
      }),
    );
  }

  async findSimilarMatchesOverThreshold(
    questionText: string,
    user: ActingUser,
    locale: Locale,
    limit = 10,
  ): Promise<SimilarQuestionMatch[]> {
    const trimmed = questionText.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const matches = await this.questionService.findSimilar(
        { questionText: trimmed },
        limit,
        undefined,
        locale,
        user.demo,
      );
      const overThreshold = matches.filter(
        (m) => m.score >= SIMILARITY_LIST_THRESHOLD,
      );
      if (overThreshold.length > 0) {
        return overThreshold;
      }
      const literal = await this.findLiteralMatchByText(
        trimmed,
        user.demo,
        locale,
      );
      return literal && literal.score >= SIMILARITY_LIST_THRESHOLD
        ? [literal]
        : [];
    } catch {
      const literal = await this.findLiteralMatchByText(
        trimmed,
        user.demo,
        locale,
      );
      return literal && literal.score >= SIMILARITY_LIST_THRESHOLD
        ? [literal]
        : [];
    }
  }

  private async findBestMatch(
    question: RecruiterAssistantSuggestedQuestionDto,
    demo: boolean,
    locale: Locale,
  ): Promise<SimilarQuestionMatch | null> {
    try {
      const matches = await this.questionService.findSimilar(
        {
          questionText: question.questionText,
          category: question.category,
          subcategory: question.subcategory,
          role: question.role,
          difficulty: question.difficulty,
        },
        1,
        undefined,
        locale,
        demo,
      );
      return (
        matches[0] ??
        (await this.findLiteralQuestionMatch(question, demo, locale))
      );
    } catch {
      return this.findLiteralQuestionMatch(question, demo, locale);
    }
  }

  private async findLiteralQuestionMatch(
    question: RecruiterAssistantSuggestedQuestionDto,
    demo: boolean,
    locale: Locale,
  ): Promise<SimilarQuestionMatch | null> {
    return this.findLiteralMatchByText(question.questionText, demo, locale);
  }

  private async findLiteralMatchByText(
    questionText: string,
    demo: boolean,
    locale: Locale,
  ): Promise<SimilarQuestionMatch | null> {
    const results = await this.questionService.findAll(
      {
        q: questionText,
        locale,
        limit: 10,
        page: 1,
        status: 'active',
      },
      { forceActive: true, resolveLocale: locale, demo },
    );
    const normalizedText = normalizeForComparison(questionText);
    const match = results.items.find(
      (item) => normalizeForComparison(item.questionText) === normalizedText,
    );
    if (!match) {
      return null;
    }
    return {
      question: match,
      score: 1,
      reasons: ['Exact question text already exists in the question bank.'],
    };
  }
}

function normalizeForComparison(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}
