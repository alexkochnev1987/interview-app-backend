import { Injectable, Logger } from '@nestjs/common';
import { Locale } from '../locale/locale.constants';
import { resolveDraftLocale } from './resolve-draft-locale';
import { QuestionDraftInput } from '../question/question-draft-input';
import { DraftQuestionMode } from './dto/ai.dto';
import { ApiErrorCode } from '../common/errors/api-error.codes';
import { apiBadRequest, apiServiceUnavailable } from '../common/errors/api-error';
import {
  QuestionDifficulty,
  QuestionDraft,
  QuestionExpectedConcept,
  QuestionRedFlag,
} from '../question/interfaces/question.interface';
import {
  buildTranslation,
  mapOutputLanguageToPrimaryLocale,
  mergeTranslations,
  primaryLocaleToOutputLanguage,
} from '../question/question-locale';
import { resolveNativeProvider } from './llm/ai-env';
import {
  runInterviewChat,
  runInterviewGreet,
  runInterviewRephrase,
} from './llm/interview-chat-llm';
import {
  generateQuestionDraftWithNativeLlm,
  translateQuestionTextWithNativeLlm,
} from './llm/question-draft-llm';
import {
  heuristicExpectedConcepts,
  heuristicFollowUps,
  heuristicRedFlags,
  heuristicSampleAnswer,
} from './question-draft-heuristic';
import { draftRubricMatchesLocale } from './question-draft-rubric-locale';

interface ChatMessage {
  role: 'system' | 'assistant' | 'candidate';
  content: string;
}

interface LlmDraftAttempt {
  draft?: QuestionDraft;
  localeMismatch: boolean;
}

const EXPLAIN_PATTERN_BY_LOCALE: Record<Locale, RegExp> = {
  en: /^explain\s+(.+)$/i,
  be: /^растлумач(?:це)?\s+(.+)$/i,
  ru: /^объясни(?:те)?\s+(.+)$/i,
  pl: /^(?:wyjaśnij|objaśnij)\s+(.+)$/i,
};

const WHAT_IS_PATTERN_BY_LOCALE: Record<Locale, RegExp> = {
  en: /^(?:what is|what's)\s+(.+)$/i,
  be: /^што такое\s+(.+)$/i,
  ru: /^что такое\s+(.+)$/i,
  pl: /^(?:co to jest|czym jest)\s+(.+)$/i,
};

const HOW_WORKS_PATTERN_BY_LOCALE: Record<Locale, RegExp> = {
  en: /^how does\s+(.+)$/i,
  be: /^як працуе\s+(.+)$/i,
  ru: /^как работает\s+(.+)$/i,
  pl: /^jak działa\s+(.+)$/i,
};

const ANY_EXPLAIN_PATTERN =
  /^(?:explain|растлумач(?:це)?|объясни(?:те)?|wyjaśnij|objaśnij)\s+(.+)$/iu;
const ANY_WHAT_IS_PATTERN =
  /^(?:what is|what's|што такое|что такое|co to jest|czym jest)\s+(.+)$/iu;
const ANY_HOW_WORKS_PATTERN =
  /^(?:how does|як працуе|как работает|jak działa)\s+(.+)$/iu;

function isAiDebugEnabled(): boolean {
  const v = process.env.AI_DEBUG?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  async rephrase(question: string): Promise<string> {
    const aiUrl = process.env.AI_API_URL?.trim();

    if (aiUrl) {
      const res = await fetch(`${aiUrl}/interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rephrase',
          question,
        }),
      });
      const data = await res.json();
      if (isAiDebugEnabled()) {
        this.logger.log(`rephrase: legacy proxy ${aiUrl}`);
      }
      return data.rephrased;
    }

    const native = resolveNativeProvider();
    if (native) {
      try {
        const text = await runInterviewRephrase(native, question);
        if (isAiDebugEnabled()) {
          this.logger.log(`rephrase: model ${native.kind} (${native.model})`);
        }
        return text;
      } catch (err) {
        if (isAiDebugEnabled()) {
          this.logger.warn(
            `rephrase: model failed, using template — ${this.formatAiError(err)}`,
          );
        }
      }
    }

    return `Let me put it differently: ${question} — In other words, could you share your experience or thoughts on this topic?`;
  }

  async chat(
    question: string,
    position: string,
    candidateName: string,
    history: ChatMessage[],
    candidateMessage: string,
  ): Promise<string> {
    const aiUrl = process.env.AI_API_URL?.trim();

    if (aiUrl) {
      const res = await fetch(`${aiUrl}/interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          question,
          position,
          candidateName,
          history,
          candidateMessage,
        }),
      });
      const data = await res.json();
      if (isAiDebugEnabled()) {
        this.logger.log(`chat: legacy proxy ${aiUrl}`);
      }
      return data.response;
    }

    const native = resolveNativeProvider();
    if (native) {
      try {
        const text = await runInterviewChat(
          native,
          question,
          position,
          candidateName,
          history,
          candidateMessage,
        );
        if (isAiDebugEnabled()) {
          this.logger.log(`chat: model ${native.kind} (${native.model})`);
        }
        return text;
      } catch (err) {
        if (isAiDebugEnabled()) {
          this.logger.warn(
            `chat: model failed, using rules — ${this.formatAiError(err)}`,
          );
        }
      }
    }

    const msg = candidateMessage.toLowerCase();

    if (
      msg.includes('rephras') ||
      msg.includes('перефразир') ||
      msg.includes('другими словами')
    ) {
      return await this.rephrase(question);
    }

    if (
      msg.includes('explain') ||
      msg.includes('объясни') ||
      msg.includes('что имеется')
    ) {
      return `Great question! I'm asking about your experience related to: "${question}". Feel free to share a specific example from your work.`;
    }

    if (
      msg.includes('ready') ||
      msg.includes('готов') ||
      msg.includes('понял')
    ) {
      return "Perfect! Go ahead and record your answer when you're ready.";
    }

    return 'I can help clarify the question, but I cannot help with the answer itself. Would you like me to rephrase the question?';
  }

  async greet(
    candidateName: string,
    position: string,
    totalQuestions: number,
  ): Promise<string> {
    const aiUrl = process.env.AI_API_URL?.trim();

    if (aiUrl) {
      const res = await fetch(`${aiUrl}/interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'greet',
          candidateName,
          position,
          totalQuestions,
        }),
      });
      const data = await res.json();
      if (isAiDebugEnabled()) {
        this.logger.log(`greet: legacy proxy ${aiUrl}`);
      }
      return data.response;
    }

    const native = resolveNativeProvider();
    if (native) {
      try {
        const text = await runInterviewGreet(
          native,
          candidateName,
          position,
          totalQuestions,
        );
        if (isAiDebugEnabled()) {
          this.logger.log(`greet: model ${native.kind} (${native.model})`);
        }
        return text;
      } catch (err) {
        if (isAiDebugEnabled()) {
          this.logger.warn(
            `greet: model failed, using template — ${this.formatAiError(err)}`,
          );
        }
      }
    }

    return `Hello, ${candidateName}! I'm your AI interviewer for the ${position} position. The interview has ${totalQuestions} questions, up to 4 minutes each. You can ask me to rephrase any question. Ready to begin?`;
  }

  async draftQuestion(
    input: QuestionDraftInput,
    localeOptions: {
      bodyLocale?: Locale;
      headerLocale: Locale;
      mode?: DraftQuestionMode;
    },
  ): Promise<QuestionDraft> {
    const draftLocale = resolveDraftLocale(
      localeOptions.bodyLocale,
      localeOptions.headerLocale,
    );
    const aiUrl = process.env.AI_API_URL?.trim();
    const base = this.normalizeDraftRequest(input, draftLocale);
    if (!base.questionText) {
      throw apiBadRequest(
        ApiErrorCode.VALIDATION_ERROR,
        'question.questionText is required to draft a question',
        { field: 'question.questionText' },
      );
    }

    const sourceLocale = this.resolveSourceLocale(input, draftLocale);
    const mode = this.resolveDraftMode(
      localeOptions.mode,
      input,
      draftLocale,
      sourceLocale,
    );
    if (mode === 'translate') {
      const sourceQuestionText = this.resolveTranslateSourceQuestionText(input);
      const translateSourceLocale = this.resolveTranslateSourceLocale(input);
      const translatedQuestionText = await this.translateQuestionText(
        sourceQuestionText,
        translateSourceLocale,
        draftLocale,
      );
      const translatedBase = this.withLocaleFields(
        { ...base, questionText: translatedQuestionText },
        base.translations,
        draftLocale,
      );
      if (isAiDebugEnabled()) {
        this.logger.log(
          `question-draft: translate mode (${translateSourceLocale} -> ${draftLocale})`,
        );
      }
      return this.buildQuestionDraft(translatedBase, draftLocale);
    }

    const llmInput = this.stripAnchorFields(base);

    if (aiUrl) {
      const proxyFirst = await this.generateProxyDraft(
        aiUrl,
        llmInput,
        base,
        draftLocale,
        false,
      );
      if (proxyFirst.draft && !proxyFirst.localeMismatch) {
        if (isAiDebugEnabled()) {
          this.logger.log(`question-draft: legacy proxy ${aiUrl}`);
        }
        return proxyFirst.draft;
      }

      if (proxyFirst.localeMismatch) {
        if (isAiDebugEnabled()) {
          this.logger.warn(
            'question-draft: proxy returned mixed-language draft, retrying once with strict locale hint',
          );
        }
        const proxyRetry = await this.generateProxyDraft(
          aiUrl,
          llmInput,
          base,
          draftLocale,
          true,
        );
        if (proxyRetry.draft && !proxyRetry.localeMismatch) {
          if (isAiDebugEnabled()) {
            this.logger.log(`question-draft: legacy proxy ${aiUrl} (strict retry)`);
          }
          return proxyRetry.draft;
        }
      }
      if (isAiDebugEnabled()) {
        this.logger.warn(
          'question-draft: proxy returned unusable JSON, trying native or heuristic',
        );
      }
    }

    const native = resolveNativeProvider();
    if (native) {
      try {
        const parsed = await generateQuestionDraftWithNativeLlm(
          native,
          llmInput,
          draftLocale,
          { strictLocale: draftLocale !== 'en' },
        );
        const firstAttempt = this.acceptLlmDraft(parsed, base, draftLocale);
        if (firstAttempt.draft && !firstAttempt.localeMismatch) {
          if (isAiDebugEnabled()) {
            this.logger.log(
              `question-draft: model ${native.kind} (${native.model})`,
            );
          }
          return firstAttempt.draft;
        }
        if (firstAttempt.localeMismatch) {
          if (isAiDebugEnabled()) {
            this.logger.warn(
              'question-draft: model returned mixed-language draft, retrying once with strict locale instructions',
            );
          }
          const strictParsed = await generateQuestionDraftWithNativeLlm(
            native,
            llmInput,
            draftLocale,
            { strictLocale: true },
          );
          const strictAttempt = this.acceptLlmDraft(strictParsed, base, draftLocale);
          if (strictAttempt.draft && !strictAttempt.localeMismatch) {
            if (isAiDebugEnabled()) {
              this.logger.log(
                `question-draft: model ${native.kind} (${native.model}) (strict retry)`,
              );
            }
            return strictAttempt.draft;
          }
        }
        if (isAiDebugEnabled()) {
          this.logger.warn(
            'question-draft: model response did not normalize, using heuristic',
          );
        }
      } catch (err) {
        if (isAiDebugEnabled()) {
          this.logger.warn(
            `question-draft: model failed, using heuristic — ${this.formatAiError(err)}`,
          );
        }
      }
    } else if (isAiDebugEnabled()) {
      this.logger.log(
        'question-draft: no AI_API_URL and no native provider (check AI_PROVIDER + API key)',
      );
    }

    if (isAiDebugEnabled()) {
      this.logger.log('question-draft: heuristic stub (no LLM)');
    }
    return this.buildQuestionDraft(base, draftLocale);
  }

  private resolveSourceLocale(
    input: QuestionDraftInput,
    fallback: Locale,
  ): Locale {
    if (input.primaryLocale) {
      return input.primaryLocale;
    }
    if (input.outputLanguage) {
      return mapOutputLanguageToPrimaryLocale(input.outputLanguage);
    }
    return fallback;
  }

  private resolveTranslateSourceLocale(
    input: QuestionDraftInput,
  ): Locale {
    if (input.primaryLocale) {
      return input.primaryLocale;
    }
    throw apiBadRequest(
      ApiErrorCode.VALIDATION_ERROR,
      'question.primaryLocale is required for translate mode',
      {
        field: 'question.primaryLocale',
        mode: 'translate',
      },
    );
  }

  private resolveTranslateSourceQuestionText(input: QuestionDraftInput): string {
    if (typeof input.questionText === 'string' && input.questionText.trim()) {
      return input.questionText.trim();
    }
    throw apiBadRequest(
      ApiErrorCode.VALIDATION_ERROR,
      'question.questionText is required for translate mode',
      {
        field: 'question.questionText',
        mode: 'translate',
      },
    );
  }

  private resolveDraftMode(
    explicitMode: DraftQuestionMode | undefined,
    input: QuestionDraftInput,
    draftLocale: Locale,
    sourceLocale: Locale,
  ): DraftQuestionMode {
    if (explicitMode) {
      return explicitMode;
    }
    if (draftLocale === sourceLocale) {
      return 'generate';
    }
    return this.hasAnyRubricSeed(input) ? 'generate' : 'translate';
  }

  private hasAnyRubricSeed(input: QuestionDraftInput): boolean {
    if (input.followUpQuestions !== undefined) return true;
    if (input.expectedConcepts !== undefined) return true;
    if (input.redFlags !== undefined) return true;
    if (input.sampleGoodAnswer !== undefined) return true;
    if (!input.translations) return false;
    return Object.values(input.translations).some((translation) => {
      if (!translation) return false;
      return (
        translation.followUpQuestions !== undefined ||
        translation.expectedConcepts !== undefined ||
        translation.redFlags !== undefined ||
        translation.sampleGoodAnswer !== undefined
      );
    });
  }

  private async translateQuestionText(
    questionText: string,
    sourceLocale: Locale,
    targetLocale: Locale,
  ): Promise<string> {
    const source = questionText.trim();
    if (!source) {
      return source;
    }
    if (sourceLocale === targetLocale) {
      throw apiBadRequest(
        ApiErrorCode.VALIDATION_ERROR,
        'question.primaryLocale and locale must be different in translate mode',
        {
          field: 'question.primaryLocale',
          sourceLocale,
          targetLocale,
          mode: 'translate',
        },
      );
    }

    const aiUrl = process.env.AI_API_URL?.trim();
    const native = resolveNativeProvider();
    const hasAiProvider = Boolean(aiUrl || native);
    let lastAiError: string | undefined;

    if (aiUrl) {
      try {
        const res = await fetch(`${aiUrl}/interview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'question-translate',
            sourceLocale,
            targetLocale,
            questionText: source,
          }),
        });
        const data = (await res.json()) as { questionText?: unknown };
        if (typeof data.questionText === 'string' && data.questionText.trim()) {
          const candidate = data.questionText.trim();
          if (!this.isSameText(candidate, source)) {
            return candidate;
          }
        }
      } catch (error) {
        lastAiError = this.formatAiError(error);
      }
    }

    if (native) {
      try {
        const translated = await translateQuestionTextWithNativeLlm(
          native,
          source,
          sourceLocale,
          targetLocale,
        );
        if (translated.trim()) {
          const candidate = translated.trim();
          if (!this.isSameText(candidate, source)) {
            return candidate;
          }
        }
      } catch (error) {
        lastAiError = this.formatAiError(error);
        if (isAiDebugEnabled()) {
          this.logger.warn(
            `question-draft: translate native LLM failed (${sourceLocale} -> ${targetLocale}): ${lastAiError}`,
          );
        }
      }
    }

    if (hasAiProvider) {
      throw apiServiceUnavailable(
        ApiErrorCode.SERVICE_UNAVAILABLE,
        'Question translation failed. The AI provider did not return a usable translation.',
        {
          sourceLocale,
          targetLocale,
          ...(lastAiError ? { cause: lastAiError } : {}),
        },
      );
    }

    const heuristic = this.heuristicTranslateQuestionText(
      source,
      sourceLocale,
      targetLocale,
    );
    if (!this.isSameText(heuristic, source)) {
      return heuristic;
    }

    throw apiServiceUnavailable(
      ApiErrorCode.AI_PROVIDER_NOT_CONFIGURED,
      'Question translation requires an AI provider or a supported template question.',
      { sourceLocale, targetLocale },
    );
  }

  private heuristicTranslateQuestionText(
    source: string,
    sourceLocale: Locale,
    targetLocale: Locale,
  ): string {
    const normalized = source.trim().replace(/[.?!]+$/, '').trim();

    const fromSourceLocale = this.matchQuestionPatternShell(
      normalized,
      EXPLAIN_PATTERN_BY_LOCALE[sourceLocale],
      WHAT_IS_PATTERN_BY_LOCALE[sourceLocale],
      HOW_WORKS_PATTERN_BY_LOCALE[sourceLocale],
      targetLocale,
    );
    if (fromSourceLocale && !this.isSameText(fromSourceLocale, source)) {
      return fromSourceLocale;
    }

    const fromAnyLocale = this.matchQuestionPatternShell(
      normalized,
      ANY_EXPLAIN_PATTERN,
      ANY_WHAT_IS_PATTERN,
      ANY_HOW_WORKS_PATTERN,
      targetLocale,
    );
    if (fromAnyLocale && !this.isSameText(fromAnyLocale, source)) {
      return fromAnyLocale;
    }

    return normalized;
  }

  private matchQuestionPatternShell(
    normalized: string,
    explainPattern: RegExp | undefined,
    whatIsPattern: RegExp | undefined,
    howWorksPattern: RegExp | undefined,
    targetLocale: Locale,
  ): string | undefined {
    const explainMatch = explainPattern?.exec(normalized);
    if (explainMatch) {
      return this.renderExplainSentence(explainMatch[1].trim(), targetLocale);
    }
    const whatIsMatch = whatIsPattern?.exec(normalized);
    if (whatIsMatch) {
      return this.renderWhatIsSentence(whatIsMatch[1].trim(), targetLocale);
    }
    const howWorksMatch = howWorksPattern?.exec(normalized);
    if (howWorksMatch) {
      return this.renderHowWorksSentence(howWorksMatch[1].trim(), targetLocale);
    }
    return undefined;
  }

  private renderExplainSentence(subject: string, targetLocale: Locale): string {
    switch (targetLocale) {
      case 'ru':
        return `Объясните ${subject}.`;
      case 'be':
        return `Растлумачце ${subject}.`;
      case 'pl':
        return `Wyjaśnij ${subject}.`;
      default:
        return `Explain ${subject}.`;
    }
  }

  private renderWhatIsSentence(subject: string, targetLocale: Locale): string {
    switch (targetLocale) {
      case 'ru':
        return `Что такое ${subject}?`;
      case 'be':
        return `Што такое ${subject}?`;
      case 'pl':
        return `Co to jest ${subject}?`;
      default:
        return `What is ${subject}?`;
    }
  }

  private renderHowWorksSentence(subject: string, targetLocale: Locale): string {
    switch (targetLocale) {
      case 'ru':
        return `Как работает ${subject}?`;
      case 'be':
        return `Як працуе ${subject}?`;
      case 'pl':
        return `Jak działa ${subject}?`;
      default:
        return `How does ${subject} work?`;
    }
  }

  private isSameText(left: string, right: string): boolean {
    const normalize = (value: string): string =>
      value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[.?!]+$/g, '');
    return normalize(left) === normalize(right);
  }

  private formatAiError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  private acceptLlmDraft(
    payload: unknown,
    base: QuestionDraft,
    draftLocale: Locale,
  ): LlmDraftAttempt {
    if (!this.llmDraftHasContent(payload)) {
      return { draft: undefined, localeMismatch: false };
    }
    const normalized = this.normalizeRemoteDraft(payload, base, draftLocale);
    if (!normalized) {
      return { draft: undefined, localeMismatch: false };
    }
    if (
      normalized.followUpQuestions.length < 2 ||
      normalized.expectedConcepts.length < 3 ||
      normalized.redFlags.length < 2 ||
      (normalized.tags?.length ?? 0) < 3 ||
      !normalized.sampleGoodAnswer ||
      !normalized.sampleGoodAnswer.trim()
    ) {
      return { draft: undefined, localeMismatch: false };
    }
    return {
      draft: normalized,
      localeMismatch: this.hasLocaleMismatch(normalized, draftLocale),
    };
  }

  private async generateProxyDraft(
    aiUrl: string,
    llmInput: Partial<QuestionDraft>,
    base: QuestionDraft,
    draftLocale: Locale,
    strictLocaleRetry: boolean,
  ): Promise<LlmDraftAttempt> {
    const res = await fetch(`${aiUrl}/interview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'question-draft',
        locale: draftLocale,
        strictLocaleRetry,
        question: llmInput,
      }),
    });
    const data = await res.json();
    return this.acceptLlmDraft(data, base, draftLocale);
  }

  private hasLocaleMismatch(draft: QuestionDraft, locale: Locale): boolean {
    return !draftRubricMatchesLocale(draft, locale);
  }

  private llmDraftHasContent(payload: unknown): boolean {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return false;
    }
    const record = payload as Record<string, unknown>;
    const hasArray = (camel: string, snake: string): boolean => {
      const value = record[camel] ?? record[snake];
      return Array.isArray(value) && value.length > 0;
    };
    const hasString = (camel: string, snake: string): boolean => {
      const value = record[camel] ?? record[snake];
      return typeof value === 'string' && value.trim().length > 0;
    };
    return (
      hasArray('followUpQuestions', 'follow_up_questions') &&
      hasArray('expectedConcepts', 'expected_concepts') &&
      hasArray('redFlags', 'red_flags') &&
      Array.isArray(record.tags) &&
      (record.tags as unknown[]).length > 0 &&
      hasString('sampleGoodAnswer', 'sample_good_answer')
    );
  }

  private stripAnchorFields(base: QuestionDraft): Partial<QuestionDraft> {
    const llmInput: Partial<QuestionDraft> = {
      questionText: base.questionText,
    };
    if (
      base.metadata &&
      typeof base.metadata === 'object' &&
      Object.keys(base.metadata).length > 0
    ) {
      llmInput.metadata = base.metadata;
    }
    return llmInput;
  }

  private normalizeDraftRequest(
    input: QuestionDraftInput,
    draftLocale: Locale,
  ): QuestionDraft {
    const primaryLocale = draftLocale;
    const outputLanguage = primaryLocaleToOutputLanguage(draftLocale);
    const primaryBlock = input.translations?.[primaryLocale];
    const questionText =
      primaryBlock?.questionText?.trim() ??
      (typeof input.questionText === 'string' ? input.questionText.trim() : '');
    const followUpQuestions = Array.isArray(primaryBlock?.followUpQuestions)
      ? primaryBlock.followUpQuestions.map((item) => item.trim()).filter(Boolean)
      : Array.isArray(input.followUpQuestions)
        ? input.followUpQuestions.map((item) => item.trim()).filter(Boolean)
        : [];
    const expectedConcepts = this.normalizeExpectedConcepts(
      primaryBlock?.expectedConcepts ?? input.expectedConcepts,
    );
    const redFlags = this.normalizeRedFlags(primaryBlock?.redFlags ?? input.redFlags);
    const sampleGoodAnswer =
      primaryBlock?.sampleGoodAnswer ??
      (typeof input.sampleGoodAnswer === 'string' && input.sampleGoodAnswer.trim()
        ? input.sampleGoodAnswer.trim()
        : undefined);

    return this.withLocaleFields({
      externalId:
        typeof input.externalId === 'string' && input.externalId.trim()
          ? input.externalId.trim()
          : undefined,
      role:
        typeof input.role === 'string' && input.role.trim()
          ? input.role.trim()
          : undefined,
      focus:
        typeof input.focus === 'string' && input.focus.trim()
          ? input.focus.trim()
          : undefined,
      outputLanguage,
      category:
        typeof input.category === 'string' && input.category.trim()
          ? input.category.trim()
          : undefined,
      subcategory:
        typeof input.subcategory === 'string' && input.subcategory.trim()
          ? input.subcategory.trim()
          : undefined,
      questionText,
      followUpQuestions,
      expectedConcepts,
      redFlags,
      difficulty: this.normalizeDifficulty(input.difficulty),
      weight: this.normalizeWeight(input.weight),
      sampleGoodAnswer,
      minimumPassScore: this.normalizeMinimumPassScore(input.minimumPassScore),
      tags: Array.isArray(input.tags)
        ? input.tags.map((item) => item.trim()).filter(Boolean)
        : [],
      metadata:
        input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
          ? input.metadata
          : {},
    }, input.translations, draftLocale);
  }

  private normalizeRemoteDraft(
    payload: unknown,
    base: QuestionDraft,
    draftLocale: Locale,
  ): QuestionDraft | undefined {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return undefined;
    }

    const record = payload as Record<string, unknown>;
    const outputLanguage = primaryLocaleToOutputLanguage(draftLocale);
    const questionText =
      typeof record.question_text === 'string'
        ? record.question_text
        : typeof record.questionText === 'string'
          ? record.questionText
          : base.questionText;
    const followUpQuestions = Array.isArray(record.follow_up_questions)
      ? (record.follow_up_questions as string[]).map((item) => item.trim()).filter(Boolean)
      : Array.isArray(record.followUpQuestions)
        ? (record.followUpQuestions as string[]).map((item) => item.trim()).filter(Boolean)
        : base.followUpQuestions;
    const expectedConcepts = this.normalizeExpectedConcepts(
      Array.isArray(record.expected_concepts)
        ? (record.expected_concepts as Array<string | Partial<QuestionExpectedConcept>>)
        : Array.isArray(record.expectedConcepts)
          ? (record.expectedConcepts as Array<string | Partial<QuestionExpectedConcept>>)
          : base.expectedConcepts,
    );
    const redFlags = this.normalizeRedFlags(
      Array.isArray(record.red_flags)
        ? (record.red_flags as Array<string | Partial<QuestionRedFlag>>)
        : Array.isArray(record.redFlags)
          ? (record.redFlags as Array<string | Partial<QuestionRedFlag>>)
          : base.redFlags,
    );
    const sampleGoodAnswer =
      typeof record.sample_good_answer === 'string'
        ? record.sample_good_answer
        : typeof record.sampleGoodAnswer === 'string'
          ? record.sampleGoodAnswer
          : base.sampleGoodAnswer;

    return this.withLocaleFields({
      externalId:
        typeof record.external_id === 'string'
          ? record.external_id
          : typeof record.externalId === 'string'
            ? record.externalId
            : base.externalId,
      role:
        typeof record.role === 'string'
          ? record.role
          : base.role,
      focus:
        typeof record.focus === 'string'
          ? record.focus
          : base.focus,
      outputLanguage,
      category:
        typeof record.category === 'string'
          ? record.category
          : base.category,
      subcategory:
        typeof record.subcategory === 'string'
          ? record.subcategory
          : base.subcategory,
      questionText,
      followUpQuestions,
      expectedConcepts,
      redFlags,
      difficulty: this.normalizeDifficulty(
        record.difficulty as QuestionDifficulty,
        base.difficulty,
      ),
      weight: this.normalizeWeight(record.weight, base.weight),
      sampleGoodAnswer,
      minimumPassScore: this.normalizeMinimumPassScore(
        record.minimum_pass_score ?? record.minimumPassScore ?? base.minimumPassScore,
      ),
      tags: Array.isArray(record.tags)
        ? (record.tags as string[]).map((item) => item.trim()).filter(Boolean)
        : base.tags,
      metadata:
        record.metadata && typeof record.metadata === 'object' && !Array.isArray(record.metadata)
          ? (record.metadata as Record<string, unknown>)
          : base.metadata,
    }, base.translations, draftLocale);
  }

  private withLocaleFields(
    draft: Omit<QuestionDraft, 'primaryLocale' | 'translations'>,
    existingTranslations?: QuestionDraft['translations'],
    forcePrimaryLocale?: Locale,
  ): QuestionDraft {
    const primaryLocale = forcePrimaryLocale
      ? forcePrimaryLocale
      : mapOutputLanguageToPrimaryLocale(draft.outputLanguage);
    const translations = mergeTranslations(
      existingTranslations,
      primaryLocale,
      buildTranslation({
        questionText: draft.questionText,
        followUpQuestions: draft.followUpQuestions,
        expectedConcepts: draft.expectedConcepts,
        redFlags: draft.redFlags,
        sampleGoodAnswer: draft.sampleGoodAnswer,
      }),
    );
    return {
      ...draft,
      primaryLocale,
      translations,
      outputLanguage: primaryLocaleToOutputLanguage(primaryLocale),
    };
  }

  private buildQuestionDraft(base: QuestionDraft, draftLocale: Locale): QuestionDraft {
    const source = [
      base.questionText,
      base.role,
      base.focus,
      base.category,
      base.subcategory,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const category = base.category ?? this.pickCategory(source);
    const subcategory = base.subcategory ?? this.pickSubcategory(source, category);
    const difficulty = this.pickDifficulty(source, base.difficulty);
    const expectedConcepts =
      base.expectedConcepts.length > 0
        ? base.expectedConcepts
        : heuristicExpectedConcepts(
            draftLocale,
            category,
            difficulty,
            (value) => this.slugify(value),
          );
    const redFlags =
      base.redFlags.length > 0
        ? base.redFlags
        : heuristicRedFlags(draftLocale, category, (value) => this.slugify(value));
    const followUpQuestions =
      base.followUpQuestions.length > 0
        ? base.followUpQuestions
        : heuristicFollowUps(draftLocale, base.questionText, category);
    const tags = Array.from(
      new Set([
        ...(base.tags ?? []),
        category,
        subcategory,
        ...(base.role ? [this.slugify(base.role)] : []),
        ...(base.focus ? base.focus.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean) : []),
      ].filter(Boolean)),
    );

    const role = base.role ?? 'frontend intern';
    const focus = base.focus ?? this.pickFocus(source, category);
    const externalId =
      base.externalId ??
      this.buildExternalId(category, subcategory, base.questionText);

    return this.withLocaleFields(
      {
        ...base,
        externalId,
        role,
        focus,
        category,
        subcategory,
        difficulty,
        outputLanguage: primaryLocaleToOutputLanguage(draftLocale),
        weight: Math.max(base.weight, difficulty === 'hard' ? 3 : difficulty === 'medium' ? 2 : 1),
        followUpQuestions,
        expectedConcepts,
        redFlags,
        sampleGoodAnswer:
          base.sampleGoodAnswer ??
          heuristicSampleAnswer(draftLocale, category, base.questionText),
        minimumPassScore:
          base.minimumPassScore > 0
            ? base.minimumPassScore
            : difficulty === 'hard'
              ? 3.5
              : difficulty === 'medium'
                ? 3
                : 2.5,
        tags,
      },
      base.translations,
      draftLocale,
    );
  }

  private pickFocus(source: string, category: string): string {
    if (/system design|architecture|scalab/.test(source)) return 'system design';
    if (/algorithm|complexity|data structure/.test(source)) return 'algorithms';
    if (/performance|optimi[sz]/.test(source)) return 'performance';
    if (/testing|test\s/.test(source)) return 'testing';
    if (category === 'soft_skills' || category === 'processes') return 'collaboration';
    return 'fundamentals';
  }

  private buildExternalId(
    category: string,
    subcategory: string,
    questionText: string,
  ): string {
    const hint = this.slugify(questionText).split('_').slice(0, 3).join('_');
    const base = [category, subcategory, hint]
      .map((part) => this.slugify(part))
      .filter(Boolean)
      .join('_');
    return base ? base.slice(0, 60) : `question_${Date.now()}`;
  }

  private pickCategory(source: string): string {
    if (source.includes('react') || source.includes('component') || source.includes('hook')) {
      return 'react';
    }
    if (source.includes('typescript') || source.includes('type ') || source.includes('interface')) {
      return 'typescript';
    }
    if (
      source.includes('javascript') ||
      source.includes('closure') ||
      source.includes('promise') ||
      source.includes('замыкание') ||
      source.includes('промис') ||
      source.includes('асинхрон') ||
      source.includes('js ')
    ) {
      return 'javascript';
    }
    if (source.includes('css') || source.includes('layout') || source.includes('flex') || source.includes('grid')) {
      return 'css';
    }
    if (source.includes('html') || source.includes('semantic') || source.includes('accessibility')) {
      return 'html';
    }
    if (source.includes('team') || source.includes('conflict') || source.includes('motivat') || source.includes('communicat')) {
      return 'soft_skills';
    }
    return 'processes';
  }

  private pickSubcategory(source: string, category: string): string {
    if (category === 'react' && source.includes('state')) {
      return 'state_management';
    }
    if (category === 'react' && source.includes('hook')) {
      return 'hooks';
    }
    if (category === 'javascript' && source.includes('async')) {
      return 'async';
    }
    if (category === 'javascript' && source.includes('closure')) {
      return 'core';
    }
    if (category === 'typescript' && source.includes('generic')) {
      return 'generics';
    }
    if (category === 'css' && source.includes('layout')) {
      return 'layout';
    }
    if (category === 'html' && source.includes('semantic')) {
      return 'semantic_html';
    }
    if (category === 'soft_skills') {
      return 'communication';
    }
    return 'fundamentals';
  }

  private pickDifficulty(
    source: string,
    current: QuestionDifficulty,
  ): QuestionDifficulty {
    if (
      source.includes('architecture') ||
      source.includes('trade-off') ||
      source.includes('performance')
    ) {
      return this.harderDifficulty(current, 'hard');
    }

    if (
      source.includes('why') ||
      source.includes('what is') ||
      source.includes('difference')
    ) {
      return current === 'hard' ? current : 'easy';
    }

    return current;
  }

  private harderDifficulty(
    current: QuestionDifficulty,
    next: QuestionDifficulty,
  ): QuestionDifficulty {
    const order: QuestionDifficulty[] = ['easy', 'medium', 'hard'];
    return order.indexOf(next) > order.indexOf(current) ? next : current;
  }

  private normalizeExpectedConcepts(
    items?: Array<string | Partial<QuestionExpectedConcept>>,
  ): QuestionExpectedConcept[] {
    const concepts = (items ?? [])
      .map((item) => {
        if (typeof item === 'string') {
          const label = item.trim();
          return label
            ? {
                id: this.slugify(label),
                label,
                weight: 1,
                description: `${label} should be covered in the answer.`,
              }
            : null;
        }

        const label = typeof item.label === 'string' ? item.label.trim() : '';
        const description =
          typeof item.description === 'string' && item.description.trim()
            ? item.description.trim()
            : `${label} should be covered in the answer.`;

        if (!label) {
          return null;
        }

        return {
          id:
            typeof item.id === 'string' && item.id.trim()
              ? item.id.trim()
              : this.slugify(label),
          label,
          weight: Number(item.weight ?? 1),
          description,
        };
      })
      .filter((item): item is QuestionExpectedConcept => Boolean(item));

    if (concepts.length === 0) {
      return [];
    }

    const total = concepts.reduce((sum, item) => {
      return sum + (Number.isFinite(item.weight) && item.weight > 0 ? item.weight : 1);
    }, 0);
    let accumulated = 0;

    return concepts.map((item, index) => {
      const rawWeight =
        Number.isFinite(item.weight) && item.weight > 0 ? item.weight : 1;
      const normalizedWeight =
        index === concepts.length - 1
          ? Number((1 - accumulated).toFixed(4))
          : Number((rawWeight / total).toFixed(4));
      accumulated = Number((accumulated + normalizedWeight).toFixed(4));

      return {
        ...item,
        weight: normalizedWeight > 0 ? normalizedWeight : Number((1 / concepts.length).toFixed(4)),
      };
    });
  }

  private normalizeRedFlags(
    items?: Array<string | Partial<QuestionRedFlag>>,
  ): QuestionRedFlag[] {
    return (items ?? [])
      .map((item) => {
        if (typeof item === 'string') {
          const label = item.trim();
          return label
            ? {
                id: this.slugify(label),
                label,
                severity: 'medium' as const,
              }
            : null;
        }

        const label = typeof item.label === 'string' ? item.label.trim() : '';
        if (!label) {
          return null;
        }

        return {
          id:
            typeof item.id === 'string' && item.id.trim()
              ? item.id.trim()
              : this.slugify(label),
          label,
          severity:
            item.severity === 'low' ||
            item.severity === 'medium' ||
            item.severity === 'high'
              ? item.severity
              : 'medium',
        };
      })
      .filter((item): item is QuestionRedFlag => Boolean(item));
  }

  private normalizeDifficulty(
    value?: QuestionDifficulty,
    fallback: QuestionDifficulty = 'medium',
  ): QuestionDifficulty {
    return value === 'easy' || value === 'medium' || value === 'hard'
      ? value
      : fallback;
  }

  private normalizeWeight(value: unknown, fallback = 1): number {
    const numeric = Number(value ?? fallback);
    return Number.isFinite(numeric) && numeric > 0
      ? Number(numeric.toFixed(2))
      : fallback;
  }

  private normalizeMinimumPassScore(value: unknown): number {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return 0;
    }
    return Number(Math.min(5, numeric).toFixed(2));
  }

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);
  }
}
