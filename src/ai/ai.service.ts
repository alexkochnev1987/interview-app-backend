import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Locale } from '../locale/locale.constants';
import { resolveDraftLocale } from './resolve-draft-locale';
import { QuestionDraftInput } from '../question/question-draft-input';
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
import { generateQuestionDraftWithNativeLlm } from './llm/question-draft-llm';

interface ChatMessage {
  role: 'system' | 'assistant' | 'candidate';
  content: string;
}

function isAiDebugEnabled(): boolean {
  const v = process.env.AI_DEBUG?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  // Mock implementation — replace with real LLM endpoint later.

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
    localeOptions: { bodyLocale?: Locale; headerLocale: Locale },
  ): Promise<QuestionDraft> {
    const draftLocale = resolveDraftLocale(
      localeOptions.bodyLocale,
      localeOptions.headerLocale,
    );
    const aiUrl = process.env.AI_API_URL?.trim();
    const base = this.normalizeDraftRequest(input, draftLocale);
    if (!base.questionText) {
      throw new BadRequestException('questionText is required to draft a question.');
    }
    const llmInput = this.stripAnchorFields(base);

    if (aiUrl) {
      const res = await fetch(`${aiUrl}/interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'question-draft',
          locale: draftLocale,
          question: llmInput,
        }),
      });
      const data = await res.json();
      const normalized = this.acceptLlmDraft(data, base, draftLocale);
      if (normalized) {
        if (isAiDebugEnabled()) {
          this.logger.log(`question-draft: legacy proxy ${aiUrl}`);
        }
        return normalized;
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
        );
        const normalized = this.acceptLlmDraft(parsed, base, draftLocale);
        if (normalized) {
          if (isAiDebugEnabled()) {
            this.logger.log(
              `question-draft: model ${native.kind} (${native.model})`,
            );
          }
          return normalized;
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
    return this.buildQuestionDraft(base);
  }

  private formatAiError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  private acceptLlmDraft(
    payload: unknown,
    base: QuestionDraft,
    draftLocale: Locale,
  ): QuestionDraft | undefined {
    if (!this.llmDraftHasContent(payload)) {
      return undefined;
    }
    const normalized = this.normalizeRemoteDraft(payload, base, draftLocale);
    if (!normalized) {
      return undefined;
    }
    if (
      normalized.followUpQuestions.length < 2 ||
      normalized.expectedConcepts.length < 3 ||
      normalized.redFlags.length < 2 ||
      (normalized.tags?.length ?? 0) < 3 ||
      !normalized.sampleGoodAnswer ||
      !normalized.sampleGoodAnswer.trim()
    ) {
      return undefined;
    }
    return normalized;
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
      externalId: base.externalId,
      outputLanguage: base.outputLanguage,
      category: base.category,
      subcategory: base.subcategory,
      questionText: base.questionText,
      metadata: base.metadata,
    };

    if (base.followUpQuestions.length > 0) {
      llmInput.followUpQuestions = base.followUpQuestions;
    }
    if (base.expectedConcepts.length > 0) {
      llmInput.expectedConcepts = base.expectedConcepts;
    }
    if (base.redFlags.length > 0) {
      llmInput.redFlags = base.redFlags;
    }
    if (base.tags.length > 0) {
      llmInput.tags = base.tags;
    }
    if (base.sampleGoodAnswer) {
      llmInput.sampleGoodAnswer = base.sampleGoodAnswer;
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
    const primaryLocale =
      forcePrimaryLocale ?? mapOutputLanguageToPrimaryLocale(draft.outputLanguage);
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

  private buildQuestionDraft(base: QuestionDraft): QuestionDraft {
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
        : this.buildExpectedConcepts(category, difficulty);
    const redFlags =
      base.redFlags.length > 0
        ? base.redFlags
        : this.buildRedFlags(category);
    const followUpQuestions =
      base.followUpQuestions.length > 0
        ? base.followUpQuestions
        : this.buildFollowUps(base.questionText, category);
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

    return {
      ...base,
      externalId,
      role,
      focus,
      category,
      subcategory,
      difficulty,
      weight: Math.max(base.weight, difficulty === 'hard' ? 3 : difficulty === 'medium' ? 2 : 1),
      followUpQuestions,
      expectedConcepts,
      redFlags,
      sampleGoodAnswer:
        base.sampleGoodAnswer ?? this.buildSampleAnswer(category, base.questionText),
      minimumPassScore:
        base.minimumPassScore > 0
          ? base.minimumPassScore
          : difficulty === 'hard'
            ? 3.5
            : difficulty === 'medium'
              ? 3
              : 2.5,
      tags,
    };
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

  private buildExpectedConcepts(
    category: string,
    difficulty: QuestionDifficulty,
  ): QuestionExpectedConcept[] {
    const conceptPresets: Record<string, string[]> = {
      html: ['semantic HTML', 'accessibility basics', 'correct structure'],
      css: ['layout reasoning', 'box model awareness', 'responsive styling'],
      javascript: ['language fundamentals', 'runtime behavior', 'practical example'],
      typescript: ['type safety', 'interface usage', 'trade-offs of typing'],
      react: ['component reasoning', 'state flow', 'render behavior'],
      soft_skills: ['clear communication', 'specific example', 'ownership'],
      processes: ['practical workflow', 'quality mindset', 'team collaboration'],
    };

    const labels =
      conceptPresets[category] ??
      ['clear reasoning', 'relevant example', 'practical outcome'];
    const weight = Number((1 / labels.length).toFixed(4));

    return labels.map((label, index) => ({
      id: `${this.slugify(category)}_${this.slugify(label)}_${index + 1}`,
      label,
      weight: index === labels.length - 1
        ? Number((1 - weight * (labels.length - 1)).toFixed(4))
        : weight,
      description:
        difficulty === 'hard'
          ? `${label} should be explained with enough detail to show strong fundamentals.`
          : `${label} should be explicitly covered in the answer.`,
    }));
  }

  private buildRedFlags(category: string): QuestionRedFlag[] {
    const preset: Record<string, Array<{ label: string; severity: 'low' | 'medium' | 'high' }>> = {
      html: [
        { label: 'Confuses HTML with CSS responsibilities', severity: 'medium' },
        { label: 'Ignores accessibility implications', severity: 'high' },
      ],
      css: [
        { label: 'Focuses only on memorized properties', severity: 'medium' },
        { label: 'No responsiveness consideration', severity: 'high' },
      ],
      javascript: [
        { label: 'Uses keywords without explanation', severity: 'medium' },
        { label: 'Incorrect explanation of core runtime behavior', severity: 'high' },
      ],
      typescript: [
        { label: 'Treats TypeScript as runtime validation', severity: 'high' },
        { label: 'No understanding of type narrowing', severity: 'medium' },
      ],
      react: [
        { label: 'Explains only syntax without data flow', severity: 'medium' },
        { label: 'Misses state and rendering implications', severity: 'high' },
      ],
      soft_skills: [
        { label: 'Answer is generic and not evidence-based', severity: 'medium' },
        { label: 'Avoids ownership in examples', severity: 'high' },
      ],
      processes: [
        { label: 'No concrete workflow example', severity: 'medium' },
        { label: 'Ignores quality or communication checks', severity: 'high' },
      ],
    };

    return (preset[category] ?? preset.processes).map((item) => ({
      id: this.slugify(item.label),
      label: item.label,
      severity: item.severity,
    }));
  }

  private buildFollowUps(questionText: string, category: string): string[] {
    if (!questionText) {
      return [];
    }

    const first =
      category === 'soft_skills'
        ? 'Can you give a specific example from your own experience?'
        : 'Can you give a simple practical example?';

    return [
      first,
      'What common mistake or misconception would you avoid?',
    ];
  }

  private buildSampleAnswer(category: string, questionText: string): string {
    if (category === 'soft_skills') {
      return `I would answer this by giving a short real example, explaining my role, what I did, and what result it led to in practice.`;
    }

    return `A strong answer to "${questionText}" should explain the idea in simple terms, mention why it matters, and give one practical example.`;
  }

  private pickCategory(source: string): string {
    if (source.includes('react') || source.includes('component') || source.includes('hook')) {
      return 'react';
    }
    if (source.includes('typescript') || source.includes('type ') || source.includes('interface')) {
      return 'typescript';
    }
    if (source.includes('javascript') || source.includes('closure') || source.includes('promise')) {
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
