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
  QuestionGenerateLlmInput,
} from './llm/question-draft-llm';
import {
  QuestionTranslateFullInput,
  translateQuestionContentWithNativeLlm,
} from './llm/question-draft-translate-llm';
import {
  heuristicExpectedConcepts,
  heuristicFollowUps,
  heuristicRedFlags,
  heuristicSampleAnswer,
} from './question-draft-heuristic';
import { draftRubricMatchesLocale } from './question-draft-rubric-locale';
import { QuestionDraftContent } from './question-draft-content';

interface ChatMessage {
  role: 'system' | 'assistant' | 'candidate';
  content: string;
}

interface LlmContentAttempt {
  content?: QuestionDraftContent;
  localeMismatch: boolean;
}

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
  ): Promise<QuestionDraft | QuestionDraftContent> {
    const draftLocale = resolveDraftLocale(
      localeOptions.bodyLocale,
      localeOptions.headerLocale,
    );
    const aiUrl = process.env.AI_API_URL?.trim();
    const sourceLocale = this.resolveSourceLocale(input, draftLocale);
    const mode = this.resolveDraftMode(
      localeOptions.mode,
      input,
      draftLocale,
      sourceLocale,
    );

    if (mode === 'translate') {
      if (!localeOptions.bodyLocale) {
        throw apiBadRequest(
          ApiErrorCode.VALIDATION_ERROR,
          'locale is required for translate mode',
          { field: 'locale', mode: 'translate' },
        );
      }
      const translateSourceLocale = this.resolveTranslateSourceLocale(input);
      if (translateSourceLocale === draftLocale) {
        throw apiBadRequest(
          ApiErrorCode.VALIDATION_ERROR,
          'question.primaryLocale and locale must be different in translate mode',
          {
            field: 'question.primaryLocale',
            sourceLocale: translateSourceLocale,
            targetLocale: draftLocale,
            mode: 'translate',
          },
        );
      }
      const primaryContent = this.extractTranslatePrimaryContent(
        input,
        translateSourceLocale,
      );
      if (isAiDebugEnabled()) {
        this.logger.log(
          `question-draft: translate mode (${translateSourceLocale} -> ${draftLocale})`,
        );
      }
      return this.translateQuestionContent(primaryContent, draftLocale, aiUrl);
    }

    const base = this.normalizeDraftRequest(input, draftLocale);
    if (!base.questionText) {
      throw apiBadRequest(
        ApiErrorCode.VALIDATION_ERROR,
        'question.questionText is required to draft a question',
        { field: 'question.questionText' },
      );
    }

    const llmInput = this.buildGenerateLlmInput(base);

    if (aiUrl) {
      const proxyFirst = await this.generateProxyDraft(
        aiUrl,
        llmInput,
        draftLocale,
        false,
      );
      if (proxyFirst.content && !proxyFirst.localeMismatch) {
        if (isAiDebugEnabled()) {
          this.logger.log(`question-draft: legacy proxy ${aiUrl}`);
        }
        return proxyFirst.content;
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
          draftLocale,
          true,
        );
        if (proxyRetry.content && !proxyRetry.localeMismatch) {
          if (isAiDebugEnabled()) {
            this.logger.log(`question-draft: legacy proxy ${aiUrl} (strict retry)`);
          }
          return proxyRetry.content;
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
        const firstAttempt = this.acceptGenerateContentDraft(parsed, draftLocale);
        if (firstAttempt.content && !firstAttempt.localeMismatch) {
          if (isAiDebugEnabled()) {
            this.logger.log(
              `question-draft: model ${native.kind} (${native.model})`,
            );
          }
          return firstAttempt.content;
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
          const strictAttempt = this.acceptGenerateContentDraft(
            strictParsed,
            draftLocale,
          );
          if (strictAttempt.content && !strictAttempt.localeMismatch) {
            if (isAiDebugEnabled()) {
              this.logger.log(
                `question-draft: model ${native.kind} (${native.model}) (strict retry)`,
              );
            }
            return strictAttempt.content;
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
    return this.buildQuestionDraftContent(base.questionText, draftLocale, {
      followUpQuestions: base.followUpQuestions,
      expectedConcepts: base.expectedConcepts,
      redFlags: base.redFlags,
      sampleGoodAnswer: base.sampleGoodAnswer,
    });
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

  private extractTranslatePrimaryContent(
    input: QuestionDraftInput,
    sourceLocale: Locale,
  ): QuestionDraftContent {
    const block = input.translations?.[sourceLocale];
    const questionText =
      (typeof block?.questionText === 'string' ? block.questionText.trim() : '') ||
      (typeof input.questionText === 'string' ? input.questionText.trim() : '');
    if (!questionText) {
      throw apiBadRequest(
        ApiErrorCode.VALIDATION_ERROR,
        'question.questionText is required for translate mode',
        { field: 'question.questionText', mode: 'translate' },
      );
    }

    const followUpQuestions = Array.isArray(block?.followUpQuestions)
      ? block.followUpQuestions.map((item) => item.trim()).filter(Boolean)
      : Array.isArray(input.followUpQuestions)
        ? input.followUpQuestions.map((item) => item.trim()).filter(Boolean)
        : [];
    if (followUpQuestions.length < 2) {
      throw apiBadRequest(
        ApiErrorCode.VALIDATION_ERROR,
        'question.followUpQuestions (at least 2) is required for translate mode',
        { field: 'question.followUpQuestions', mode: 'translate' },
      );
    }

    const expectedConcepts = this.normalizeExpectedConcepts(
      block?.expectedConcepts ?? input.expectedConcepts,
    );
    if (expectedConcepts.length < 3) {
      throw apiBadRequest(
        ApiErrorCode.VALIDATION_ERROR,
        'question.expectedConcepts (at least 3) is required for translate mode',
        { field: 'question.expectedConcepts', mode: 'translate' },
      );
    }

    const redFlags = this.normalizeRedFlags(block?.redFlags ?? input.redFlags);
    if (redFlags.length < 2) {
      throw apiBadRequest(
        ApiErrorCode.VALIDATION_ERROR,
        'question.redFlags (at least 2) is required for translate mode',
        { field: 'question.redFlags', mode: 'translate' },
      );
    }

    const sampleGoodAnswer =
      (typeof block?.sampleGoodAnswer === 'string' ? block.sampleGoodAnswer.trim() : '') ||
      (typeof input.sampleGoodAnswer === 'string' ? input.sampleGoodAnswer.trim() : '');
    if (!sampleGoodAnswer) {
      throw apiBadRequest(
        ApiErrorCode.VALIDATION_ERROR,
        'question.sampleGoodAnswer is required for translate mode',
        { field: 'question.sampleGoodAnswer', mode: 'translate' },
      );
    }

    return {
      primaryLocale: sourceLocale,
      questionText,
      followUpQuestions,
      expectedConcepts,
      redFlags,
      sampleGoodAnswer,
    };
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
    return this.hasFullPrimaryContent(input, sourceLocale) ? 'translate' : 'generate';
  }

  private hasFullPrimaryContent(
    input: QuestionDraftInput,
    sourceLocale: Locale,
  ): boolean {
    const block = input.translations?.[sourceLocale];
    const questionText =
      (typeof block?.questionText === 'string' ? block.questionText.trim() : '') ||
      (typeof input.questionText === 'string' ? input.questionText.trim() : '');
    if (!questionText) {
      return false;
    }
    const followUpQuestions = Array.isArray(block?.followUpQuestions)
      ? block.followUpQuestions
      : input.followUpQuestions;
    if (!Array.isArray(followUpQuestions) || followUpQuestions.filter(Boolean).length < 2) {
      return false;
    }
    const expectedConcepts = block?.expectedConcepts ?? input.expectedConcepts;
    if (!Array.isArray(expectedConcepts) || expectedConcepts.length < 3) {
      return false;
    }
    const redFlags = block?.redFlags ?? input.redFlags;
    if (!Array.isArray(redFlags) || redFlags.length < 2) {
      return false;
    }
    const sampleGoodAnswer =
      (typeof block?.sampleGoodAnswer === 'string' ? block.sampleGoodAnswer.trim() : '') ||
      (typeof input.sampleGoodAnswer === 'string' ? input.sampleGoodAnswer.trim() : '');
    return Boolean(sampleGoodAnswer);
  }

  private buildTranslateLlmInput(
    primary: QuestionDraftContent,
    targetLocale: Locale,
  ): QuestionTranslateFullInput {
    return {
      sourceLocale: primary.primaryLocale,
      targetLocale,
      content: {
        questionText: primary.questionText,
        followUpQuestions: primary.followUpQuestions,
        expectedConcepts: primary.expectedConcepts,
        redFlags: primary.redFlags,
        sampleGoodAnswer: primary.sampleGoodAnswer,
      },
    };
  }

  private async translateQuestionContent(
    primary: QuestionDraftContent,
    targetLocale: Locale,
    aiUrl?: string,
  ): Promise<QuestionDraftContent> {
    const llmInput = this.buildTranslateLlmInput(primary, targetLocale);
    const native = resolveNativeProvider();
    const hasAiProvider = Boolean(aiUrl || native);
    let lastAiError: string | undefined;

    if (aiUrl) {
      try {
        const proxyFirst = await this.translateProxyContent(
          aiUrl,
          primary,
          targetLocale,
          false,
        );
        if (proxyFirst.content && !proxyFirst.localeMismatch) {
          if (isAiDebugEnabled()) {
            this.logger.log(`question-draft: legacy proxy translate ${aiUrl}`);
          }
          return proxyFirst.content;
        }
        if (proxyFirst.localeMismatch) {
          const proxyRetry = await this.translateProxyContent(
            aiUrl,
            primary,
            targetLocale,
            true,
          );
          if (proxyRetry.content && !proxyRetry.localeMismatch) {
            return proxyRetry.content;
          }
        }
      } catch (error) {
        lastAiError = this.formatAiError(error);
      }
    }

    if (native) {
      try {
        const parsed = await translateQuestionContentWithNativeLlm(native, llmInput);
        const firstAttempt = this.acceptTranslateContentDraft(
          parsed,
          primary,
          targetLocale,
        );
        if (firstAttempt.content && !firstAttempt.localeMismatch) {
          if (isAiDebugEnabled()) {
            this.logger.log(
              `question-draft: translate model ${native.kind} (${native.model})`,
            );
          }
          return firstAttempt.content;
        }
        if (firstAttempt.localeMismatch) {
          const strictParsed = await translateQuestionContentWithNativeLlm(
            native,
            llmInput,
          );
          const strictAttempt = this.acceptTranslateContentDraft(
            strictParsed,
            primary,
            targetLocale,
          );
          if (strictAttempt.content && !strictAttempt.localeMismatch) {
            return strictAttempt.content;
          }
        }
      } catch (error) {
        lastAiError = this.formatAiError(error);
        if (isAiDebugEnabled()) {
          this.logger.warn(
            `question-draft: translate native LLM failed (${primary.primaryLocale} -> ${targetLocale}): ${lastAiError}`,
          );
        }
      }
    }

    if (hasAiProvider) {
      throw apiServiceUnavailable(
        ApiErrorCode.SERVICE_UNAVAILABLE,
        'Question translation failed. The AI provider did not return a usable translation.',
        {
          sourceLocale: primary.primaryLocale,
          targetLocale,
          ...(lastAiError ? { cause: lastAiError } : {}),
        },
      );
    }

    throw apiServiceUnavailable(
      ApiErrorCode.AI_PROVIDER_NOT_CONFIGURED,
      'Question translation requires an AI provider.',
      { sourceLocale: primary.primaryLocale, targetLocale },
    );
  }

  private async translateProxyContent(
    aiUrl: string,
    primary: QuestionDraftContent,
    targetLocale: Locale,
    strictLocaleRetry: boolean,
  ): Promise<LlmContentAttempt> {
    const res = await fetch(`${aiUrl}/interview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'question-draft',
        mode: 'translate',
        locale: targetLocale,
        sourceLocale: primary.primaryLocale,
        strictLocaleRetry,
        question: {
          questionText: primary.questionText,
          followUpQuestions: primary.followUpQuestions,
          expectedConcepts: primary.expectedConcepts,
          redFlags: primary.redFlags,
          sampleGoodAnswer: primary.sampleGoodAnswer,
        },
      }),
    });
    const data = await this.readLegacyProxyJson(res, 'question-draft translate');
    return this.acceptTranslateContentDraft(data, primary, targetLocale);
  }

  private acceptTranslateContentDraft(
    payload: unknown,
    primary: QuestionDraftContent,
    targetLocale: Locale,
  ): LlmContentAttempt {
    if (!this.llmGenerateHasContent(payload)) {
      return { content: undefined, localeMismatch: false };
    }
    const normalized = this.normalizeGenerateContent(payload, targetLocale);
    if (!normalized) {
      return { content: undefined, localeMismatch: false };
    }
    const withIds = this.enforceTranslateIdParity(primary, normalized, targetLocale);
    if (!withIds) {
      return { content: undefined, localeMismatch: false };
    }
    if (
      this.isSameText(withIds.questionText, primary.questionText) &&
      draftRubricMatchesLocale(withIds, primary.primaryLocale)
    ) {
      return { content: undefined, localeMismatch: false };
    }
    return {
      content: withIds,
      localeMismatch: !draftRubricMatchesLocale(withIds, targetLocale),
    };
  }

  private enforceTranslateIdParity(
    primary: QuestionDraftContent,
    translated: QuestionDraftContent,
    targetLocale: Locale,
  ): QuestionDraftContent | undefined {
    if (
      translated.followUpQuestions.length !== primary.followUpQuestions.length ||
      translated.expectedConcepts.length !== primary.expectedConcepts.length ||
      translated.redFlags.length !== primary.redFlags.length
    ) {
      return undefined;
    }

    for (let index = 0; index < primary.expectedConcepts.length; index += 1) {
      const llmId = translated.expectedConcepts[index]?.id?.trim();
      if (llmId && llmId !== primary.expectedConcepts[index].id) {
        return undefined;
      }
    }
    for (let index = 0; index < primary.redFlags.length; index += 1) {
      const llmId = translated.redFlags[index]?.id?.trim();
      if (llmId && llmId !== primary.redFlags[index].id) {
        return undefined;
      }
    }

    return {
      primaryLocale: targetLocale,
      questionText: translated.questionText,
      followUpQuestions: translated.followUpQuestions,
      expectedConcepts: translated.expectedConcepts.map((concept, index) => {
        const source = primary.expectedConcepts[index];
        return {
          id: source.id,
          label: concept.label,
          weight: source.weight,
          description: concept.description,
        };
      }),
      redFlags: translated.redFlags.map((flag, index) => {
        const source = primary.redFlags[index];
        return {
          id: source.id,
          label: flag.label,
          severity: source.severity,
        };
      }),
      sampleGoodAnswer: translated.sampleGoodAnswer,
    };
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

  private async readLegacyProxyJson(res: Response, action: string): Promise<unknown> {
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(
        `Legacy AI proxy ${action} failed: HTTP ${res.status}${
          detail ? ` — ${detail.slice(0, 200)}` : ''
        }`,
      );
    }
    return res.json() as Promise<unknown>;
  }

  private acceptGenerateContentDraft(
    payload: unknown,
    draftLocale: Locale,
  ): LlmContentAttempt {
    if (!this.llmGenerateHasContent(payload)) {
      return { content: undefined, localeMismatch: false };
    }
    const normalized = this.normalizeGenerateContent(payload, draftLocale);
    if (!normalized) {
      return { content: undefined, localeMismatch: false };
    }
    return {
      content: normalized,
      localeMismatch: !draftRubricMatchesLocale(normalized, draftLocale),
    };
  }

  private async generateProxyDraft(
    aiUrl: string,
    llmInput: QuestionGenerateLlmInput,
    draftLocale: Locale,
    strictLocaleRetry: boolean,
  ): Promise<LlmContentAttempt> {
    const res = await fetch(`${aiUrl}/interview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'question-draft',
        mode: 'generate',
        locale: draftLocale,
        strictLocaleRetry,
        question: llmInput,
      }),
    });
    const data = await this.readLegacyProxyJson(res, 'question-draft generate');
    return this.acceptGenerateContentDraft(data, draftLocale);
  }

  private llmGenerateHasContent(payload: unknown): boolean {
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
      hasString('questionText', 'question_text') &&
      hasArray('followUpQuestions', 'follow_up_questions') &&
      hasArray('expectedConcepts', 'expected_concepts') &&
      hasArray('redFlags', 'red_flags') &&
      hasString('sampleGoodAnswer', 'sample_good_answer')
    );
  }

  private buildGenerateLlmInput(base: QuestionDraft): QuestionGenerateLlmInput {
    const metadata: Record<string, unknown> = {
      ...(base.metadata ?? {}),
    };
    if (base.category) {
      metadata.category = base.category;
    }
    if (base.subcategory) {
      metadata.subcategory = base.subcategory;
    }
    if (base.role) {
      metadata.role = base.role;
    }
    if (base.focus) {
      metadata.focus = base.focus;
    }
    if (base.tags?.length) {
      metadata.tags = base.tags;
    }
    if (base.difficulty) {
      metadata.difficulty = base.difficulty;
    }
    if (base.weight) {
      metadata.weight = base.weight;
    }
    if (base.minimumPassScore) {
      metadata.minimumPassScore = base.minimumPassScore;
    }
    if (base.externalId) {
      metadata.externalId = base.externalId;
    }

    return {
      questionText: base.questionText,
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    };
  }

  private normalizeGenerateContent(
    payload: unknown,
    draftLocale: Locale,
  ): QuestionDraftContent | undefined {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return undefined;
    }

    const record = payload as Record<string, unknown>;
    const questionText =
      typeof record.question_text === 'string' && record.question_text.trim()
        ? record.question_text.trim()
        : typeof record.questionText === 'string' && record.questionText.trim()
          ? record.questionText.trim()
          : '';
    const followUpQuestions = Array.isArray(record.follow_up_questions)
      ? (record.follow_up_questions as string[]).map((item) => item.trim()).filter(Boolean)
      : Array.isArray(record.followUpQuestions)
        ? (record.followUpQuestions as string[]).map((item) => item.trim()).filter(Boolean)
        : [];
    const expectedConcepts = this.normalizeExpectedConcepts(
      Array.isArray(record.expected_concepts)
        ? (record.expected_concepts as Array<string | Partial<QuestionExpectedConcept>>)
        : Array.isArray(record.expectedConcepts)
          ? (record.expectedConcepts as Array<string | Partial<QuestionExpectedConcept>>)
          : [],
    );
    const redFlags = this.normalizeRedFlags(
      Array.isArray(record.red_flags)
        ? (record.red_flags as Array<string | Partial<QuestionRedFlag>>)
        : Array.isArray(record.redFlags)
          ? (record.redFlags as Array<string | Partial<QuestionRedFlag>>)
          : [],
    );
    const sampleGoodAnswer =
      typeof record.sample_good_answer === 'string'
        ? record.sample_good_answer.trim()
        : typeof record.sampleGoodAnswer === 'string'
          ? record.sampleGoodAnswer.trim()
          : '';

    if (
      !questionText ||
      followUpQuestions.length < 2 ||
      expectedConcepts.length < 3 ||
      redFlags.length < 2 ||
      !sampleGoodAnswer
    ) {
      return undefined;
    }

    return this.buildQuestionDraftContent(questionText, draftLocale, {
      followUpQuestions,
      expectedConcepts,
      redFlags,
      sampleGoodAnswer,
    });
  }

  private buildQuestionDraftContent(
    questionText: string,
    draftLocale: Locale,
    partial: {
      followUpQuestions?: string[];
      expectedConcepts?: QuestionExpectedConcept[];
      redFlags?: QuestionRedFlag[];
      sampleGoodAnswer?: string;
    } = {},
  ): QuestionDraftContent {
    const source = questionText.toLowerCase();
    const category = this.pickCategory(source);
    const difficulty = this.pickDifficulty(source, 'medium');
    const followUpQuestions =
      partial.followUpQuestions && partial.followUpQuestions.length > 0
        ? partial.followUpQuestions
        : heuristicFollowUps(draftLocale, questionText, category);
    const expectedConcepts =
      partial.expectedConcepts && partial.expectedConcepts.length > 0
        ? partial.expectedConcepts
        : heuristicExpectedConcepts(
            draftLocale,
            category,
            difficulty,
            (value) => this.slugify(value),
          );
    const redFlags =
      partial.redFlags && partial.redFlags.length > 0
        ? partial.redFlags
        : heuristicRedFlags(draftLocale, category, (value) => this.slugify(value));
    const sampleGoodAnswer =
      partial.sampleGoodAnswer?.trim() ||
      heuristicSampleAnswer(draftLocale, category, questionText);

    return {
      primaryLocale: draftLocale,
      questionText,
      followUpQuestions,
      expectedConcepts,
      redFlags,
      sampleGoodAnswer,
    };
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
