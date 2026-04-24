import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { QuestionService } from '../question/question.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { matchesInterviewMediaKey } from '../upload/upload-key';
import {
  Answer,
  AnswerBehaviorEvent,
  AnswerBehaviorSignals,
  AnswerEvaluation,
  AnswerTranscript,
  AnswerValidation,
  AnswerVersion,
  Interview,
  InterviewQuestion,
  InterviewResult,
  InterviewQuestionResult,
  InterviewWorkflow,
  MediaArtifact,
} from './interfaces/interview.interface';

interface InterviewRow {
  id: string;
  candidate_name: string;
  position: string;
  questions_json: InterviewQuestion[] | null;
  answers_json: Record<string, unknown>[] | null;
  status: Interview['status'];
  result_json: Record<string, unknown> | null;
  workflow_json: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

interface AddAnswerInput {
  questionIndex: number;
  versionNumber: number;
  submitAnswer: boolean;
  mediaKey: string;
  screenMediaKey?: string;
  durationSeconds?: number;
  startedAt?: Date;
  submittedAt?: Date;
  cameraFileSizeBytes?: number;
  screenFileSizeBytes?: number;
  behaviorSignals?: AnswerBehaviorSignals;
  behaviorEvents?: AnswerBehaviorEvent[];
  clientTranscript?: AnswerTranscript;
}

interface SaveAnswerProgressInput {
  questionIndex: number;
  versionNumber: number;
  mediaKey: string;
  screenMediaKey?: string;
  durationSeconds?: number;
  startedAt?: Date;
  submittedAt?: Date;
  cameraFileSizeBytes?: number;
  screenFileSizeBytes?: number;
  behaviorSignals?: AnswerBehaviorSignals;
  behaviorEvents?: AnswerBehaviorEvent[];
}

interface QueueAnswerValidationInput {
  questionIndex: number;
  sourceVersionNumber: number;
  executionArn?: string;
  requestedAt: Date;
}

interface CompleteAnswerValidationInput {
  questionIndex: number;
  sourceVersionNumber: number;
  executionArn?: string;
  transcript?: AnswerTranscript;
  evaluation?: AnswerEvaluation;
  completedAt: Date;
}

interface FailAnswerValidationInput {
  questionIndex: number;
  sourceVersionNumber?: number;
  executionArn?: string;
  errorMessage?: string;
  completedAt: Date;
}

@Injectable()
export class InterviewService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly questionService: QuestionService,
  ) {}

  async create(dto: CreateInterviewDto): Promise<Interview> {
    const candidateName = dto.candidateName.trim();
    const position = dto.position.trim();
    const questionIds = dto.questionIds.map((id) => id.trim()).filter(Boolean);

    if (!candidateName) {
      throw new BadRequestException('Candidate name is required');
    }
    if (!position) {
      throw new BadRequestException('Position is required');
    }
    if (questionIds.length === 0) {
      throw new BadRequestException('At least one question must be selected');
    }

    const questions = await this.questionService.findManyByIds(questionIds);
    const result = await this.databaseService.query<InterviewRow>(
      `
        INSERT INTO interviews (
          id,
          candidate_name,
          position,
          questions_json,
          answers_json,
          status,
          workflow_json
        )
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7::jsonb)
        RETURNING
          id,
          candidate_name,
          position,
          questions_json,
          answers_json,
          status,
          result_json,
          workflow_json,
          created_at,
          updated_at
      `,
      [
        randomUUID(),
        candidateName,
        position,
        JSON.stringify(questions),
        JSON.stringify([]),
        'pending',
        JSON.stringify(this.buildWorkflow('idle', new Date())),
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  async findAll(): Promise<Interview[]> {
    const result = await this.databaseService.query<InterviewRow>(
      `
        SELECT
          id,
          candidate_name,
          position,
          questions_json,
          answers_json,
          status,
          result_json,
          workflow_json,
          created_at,
          updated_at
        FROM interviews
        ORDER BY created_at DESC
      `,
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  async findOne(id: string): Promise<Interview> {
    const result = await this.databaseService.query<InterviewRow>(
      `
        SELECT
          id,
          candidate_name,
          position,
          questions_json,
          answers_json,
          status,
          result_json,
          workflow_json,
          created_at,
          updated_at
        FROM interviews
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    if (!result.rows[0]) {
      throw new NotFoundException(`Interview with id "${id}" not found`);
    }

    return this.mapRow(result.rows[0]);
  }

  async complete(id: string): Promise<Interview> {
    const interview = await this.findOne(id);
    if (this.getSubmittedAnswerCount(interview) < interview.questions.length) {
      throw new BadRequestException(
        'Interview can only be completed after all answers are submitted',
      );
    }
    const now = new Date();
    const updated = await this.saveInterview({
      ...interview,
      status: 'processing',
      workflow: this.buildWorkflow('processing', now, {
        currentStage: 'validate_answers',
        startedAt: interview.workflow?.startedAt ?? now,
      }),
      updatedAt: now,
    });

    this.simulateProcessing(updated.id);
    return updated;
  }

  async getResults(id: string): Promise<InterviewResult> {
    const interview = await this.findOne(id);
    if (interview.status !== 'completed' || !interview.result) {
      throw new NotFoundException(
        `Results for interview "${id}" are not available yet (status: ${interview.status})`,
      );
    }
    return interview.result;
  }

  async addAnswer(
    id: string,
    input: AddAnswerInput,
  ): Promise<Interview> {
    return this.persistAnswerVersion(id, input, {
      mergeBehaviorEvents: false,
      preserveLatestSelectedVersion: false,
      submittedAtFallback: 'now',
    });
  }

  async saveAnswerProgress(
    id: string,
    input: SaveAnswerProgressInput,
  ): Promise<Interview> {
    return this.persistAnswerVersion(
      id,
      {
        ...input,
        submitAnswer: false,
      },
      {
        mergeBehaviorEvents: true,
        preserveLatestSelectedVersion: true,
        submittedAtFallback: 'keep',
      },
    );
  }

  async queueAnswerValidation(
    id: string,
    input: QueueAnswerValidationInput,
  ): Promise<Interview> {
    const interview = await this.findOne(id);
    const answer = this.requireAnswer(interview, input.questionIndex);
    const now = new Date(input.requestedAt);

    const nextAnswer: Answer = {
      ...answer,
      validation: {
        status: 'queued',
        executionArn: input.executionArn,
        sourceVersionNumber: input.sourceVersionNumber,
        requestedAt: now,
        startedAt: now,
        errorMessage: undefined,
      },
    };

    return this.saveInterviewWithUpdatedAnswer(interview, nextAnswer);
  }

  async completeAnswerValidation(
    id: string,
    input: CompleteAnswerValidationInput,
  ): Promise<Interview> {
    const interview = await this.findOne(id);
    const answer = this.requireAnswer(interview, input.questionIndex);

    const nextAnswer: Answer = {
      ...answer,
      transcript: input.transcript ?? answer.transcript,
      evaluation: input.evaluation ?? answer.evaluation,
      validation: {
        status: 'completed',
        executionArn:
          input.executionArn ?? answer.validation?.executionArn,
        sourceVersionNumber: input.sourceVersionNumber,
        requestedAt:
          answer.validation?.requestedAt ?? input.completedAt,
        startedAt:
          answer.validation?.startedAt ?? input.completedAt,
        completedAt: input.completedAt,
      },
    };

    return this.saveInterviewWithUpdatedAnswer(interview, nextAnswer);
  }

  async failAnswerValidation(
    id: string,
    input: FailAnswerValidationInput,
  ): Promise<Interview> {
    const interview = await this.findOne(id);
    const answer = this.requireAnswer(interview, input.questionIndex);

    const nextAnswer: Answer = {
      ...answer,
      validation: {
        status: 'failed',
        executionArn:
          input.executionArn ?? answer.validation?.executionArn,
        sourceVersionNumber:
          input.sourceVersionNumber ?? answer.validation?.sourceVersionNumber,
        requestedAt:
          answer.validation?.requestedAt ?? input.completedAt,
        startedAt:
          answer.validation?.startedAt ?? answer.validation?.requestedAt,
        completedAt: input.completedAt,
        errorMessage:
          input.errorMessage ??
          answer.validation?.errorMessage ??
          'Answer validation failed',
      },
    };

    return this.saveInterviewWithUpdatedAnswer(interview, nextAnswer);
  }

  private async persistAnswerVersion(
    id: string,
    input: AddAnswerInput,
    options: {
      mergeBehaviorEvents: boolean;
      preserveLatestSelectedVersion: boolean;
      submittedAtFallback: 'now' | 'keep';
    },
  ): Promise<Interview> {
    const interview = await this.findOne(id);
    const {
      questionIndex,
      versionNumber,
      submitAnswer,
      mediaKey,
      screenMediaKey,
      durationSeconds,
      startedAt,
      submittedAt,
      cameraFileSizeBytes,
      screenFileSizeBytes,
      behaviorSignals,
      behaviorEvents,
      clientTranscript,
    } = input;

    const currentQuestionIndex = this.getSubmittedAnswerCount(interview);
    if (questionIndex !== currentQuestionIndex) {
      throw new BadRequestException(
        'Invalid question index — must answer in order',
      );
    }
    if (questionIndex >= interview.questions.length) {
      throw new BadRequestException('Question index is out of range');
    }
    if (
      !matchesInterviewMediaKey({
        mediaKey,
        interviewId: id,
        questionIndex,
        mediaType: 'camera',
      })
    ) {
      throw new BadRequestException('Invalid camera recording key');
    }
    if (
      screenMediaKey &&
      !matchesInterviewMediaKey({
        mediaKey: screenMediaKey,
        interviewId: id,
        questionIndex,
        mediaType: 'screen',
      })
    ) {
      throw new BadRequestException('Invalid screen recording key');
    }

    const question = interview.questions[questionIndex];
    const existingAnswer =
      interview.answers.find((answer) => answer.questionIndex === questionIndex) ??
      undefined;
    if (existingAnswer?.status === 'submitted' && !submitAnswer) {
      throw new BadRequestException(
        'Cannot update recording progress for a submitted answer',
      );
    }

    const normalizedVersionNumber =
      typeof versionNumber === 'number' && versionNumber > 0
        ? versionNumber
        : 1;
    const existingVersions = this.getAnswerVersions(existingAnswer);
    const existingVersion = existingVersions.find(
      (version) => version.versionNumber === normalizedVersionNumber,
    );

    const uploadedAt = existingVersion?.uploadedAt ?? new Date();
    const normalizedStartedAt =
      startedAt && !Number.isNaN(startedAt.getTime())
        ? startedAt
        : existingVersion?.startedAt;
    const normalizedSubmittedAt = this.resolveSubmittedAt({
      submittedAt,
      uploadedAt,
      existingVersion,
      fallback: options.submittedAtFallback,
    });

    if (
      normalizedStartedAt &&
      normalizedSubmittedAt &&
      normalizedSubmittedAt.getTime() < normalizedStartedAt.getTime()
    ) {
      throw new BadRequestException(
        'submittedAt must be after startedAt for the answer',
      );
    }

    const normalizedBehaviorSignals = this.mergeBehaviorSignals(
      existingVersion?.behaviorSignals ??
        existingAnswer?.behaviorSignals,
      behaviorSignals,
    );
    const normalizedBehaviorEvents = this.buildBehaviorEventsSnapshot(
      existingVersion?.behaviorEvents ??
        existingAnswer?.behaviorEvents,
      behaviorEvents,
      normalizedVersionNumber,
      options.mergeBehaviorEvents,
    );
    const currentVersion: AnswerVersion = {
      versionNumber: normalizedVersionNumber,
      mediaKey,
      screenMediaKey,
      uploadedAt,
      durationSeconds:
        typeof durationSeconds === 'number' && durationSeconds > 0
          ? durationSeconds
          : existingVersion?.durationSeconds,
      startedAt: normalizedStartedAt,
      submittedAt: normalizedSubmittedAt,
      camera: this.buildMediaArtifact({
        mediaKey,
        uploadedAt,
        fileSizeBytes:
          this.normalizePositiveNumber(cameraFileSizeBytes) ??
          existingVersion?.camera?.fileSizeBytes ??
          existingAnswer?.camera?.fileSizeBytes,
      }),
      screen: screenMediaKey
        ? this.buildMediaArtifact({
            mediaKey: screenMediaKey,
            uploadedAt,
            fileSizeBytes:
              this.normalizePositiveNumber(screenFileSizeBytes) ??
              existingVersion?.screen?.fileSizeBytes ??
              existingAnswer?.screen?.fileSizeBytes,
          })
        : undefined,
      behaviorSignals: normalizedBehaviorSignals,
      behaviorEvents: normalizedBehaviorEvents,
    };

    const nextVersions = [
      ...existingVersions.filter(
        (version) => version.versionNumber !== normalizedVersionNumber,
      ),
      currentVersion,
    ].sort((left, right) => left.versionNumber - right.versionNumber);

    const selectedVersionNumber = options.preserveLatestSelectedVersion
      ? Math.max(
          existingAnswer?.selectedVersionNumber ?? 0,
          normalizedVersionNumber,
        )
      : normalizedVersionNumber;
    const selectedVersion =
      nextVersions.find(
        (version) => version.versionNumber === selectedVersionNumber,
      ) ?? currentVersion;

    const nextAnswer: Answer = {
      questionIndex,
      questionId: question.id,
      status: submitAnswer ? 'submitted' : 'recording',
      mediaKey: selectedVersion.mediaKey,
      screenMediaKey: selectedVersion.screenMediaKey,
      uploadedAt: selectedVersion.uploadedAt,
      durationSeconds: selectedVersion.durationSeconds,
      retakeCount: Math.max(nextVersions.length - 1, 0),
      startedAt: selectedVersion.startedAt,
      submittedAt: selectedVersion.submittedAt,
      camera: selectedVersion.camera,
      screen: selectedVersion.screen,
      behaviorSignals: selectedVersion.behaviorSignals,
      selectedVersionNumber,
      versions: nextVersions,
      behaviorEvents: selectedVersion.behaviorEvents,
      transcript: clientTranscript ?? existingAnswer?.transcript,
      evaluation: existingAnswer?.evaluation,
      validation: existingAnswer?.validation,
    };

    const nextAnswers = existingAnswer
      ? interview.answers.map((answer) =>
          answer.questionIndex === questionIndex ? nextAnswer : answer,
        )
      : [...interview.answers, nextAnswer].sort(
          (left, right) => left.questionIndex - right.questionIndex,
        );

    const now = new Date();
    return this.saveInterview({
      ...interview,
      answers: nextAnswers,
      status: 'in_progress',
      workflow: this.buildWorkflow('idle', now, {
        startedAt: interview.workflow?.startedAt,
      }),
      updatedAt: now,
    });
  }

  private requireAnswer(interview: Interview, questionIndex: number): Answer {
    const answer = interview.answers.find(
      (item) => item.questionIndex === questionIndex,
    );

    if (!answer) {
      throw new BadRequestException(
        `Answer for question ${questionIndex} is not available`,
      );
    }

    return answer;
  }

  private saveInterviewWithUpdatedAnswer(
    interview: Interview,
    nextAnswer: Answer,
  ): Promise<Interview> {
    const now = new Date();

    return this.saveInterview({
      ...interview,
      answers: interview.answers.map((answer) =>
        answer.questionIndex === nextAnswer.questionIndex ? nextAnswer : answer,
      ),
      updatedAt: now,
    });
  }

  private async saveInterview(interview: Interview): Promise<Interview> {
    const result = await this.databaseService.query<InterviewRow>(
      `
        UPDATE interviews
        SET
          candidate_name = $2,
          position = $3,
          questions_json = $4::jsonb,
          answers_json = $5::jsonb,
          status = $6,
          result_json = $7::jsonb,
          workflow_json = $8::jsonb,
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          candidate_name,
          position,
          questions_json,
          answers_json,
          status,
          result_json,
          workflow_json,
          created_at,
          updated_at
      `,
      [
        interview.id,
        interview.candidateName,
        interview.position,
        JSON.stringify(interview.questions),
        JSON.stringify(interview.answers),
        interview.status,
        interview.result ? JSON.stringify(interview.result) : null,
        interview.workflow ? JSON.stringify(interview.workflow) : null,
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Placeholder for Step Functions invocation.
   * Simulates async processing by completing after a short delay.
   */
  private simulateProcessing(interviewId: string): void {
    setTimeout(async () => {
      try {
        const interview = await this.findOne(interviewId);
        const completedAt = new Date();
        await this.saveInterview({
          ...interview,
          result: {
            overallScore: 75,
            summary: 'Simulated evaluation result',
            categoryScores: {
              technical: 80,
              communication: 70,
              problemSolving: 75,
            },
            rubricVersion: 'placeholder-v1',
            decision: 'review',
            trustScore: 100,
            trustFlags: [],
            behaviorSummary: {
              riskLevel: 'low',
              notes: ['Behavior analysis is still using placeholder data.'],
            },
            questionResults: interview.answers
              .filter((answer) => answer.status === 'submitted')
              .map((answer) => ({
              questionIndex: answer.questionIndex,
              questionId: answer.questionId,
              score: 75,
              categoryScores: {
                relevance: 75,
                depth: 75,
                communication: 75,
              },
              summary: 'Placeholder per-question evaluation.',
              decisionHint: 'review',
              })),
            completedAt,
          },
          status: 'completed',
          workflow: this.buildWorkflow('completed', completedAt, {
            currentStage: 'store_result',
            startedAt: interview.workflow?.startedAt,
            completedAt,
          }),
          updatedAt: completedAt,
        });
      } catch (error) {
        console.error('Failed to simulate interview processing', error);
      }
    }, 2000);
  }

  private mapRow(row: InterviewRow): Interview {
    const questions = (row.questions_json ?? []).map((question) =>
      this.questionService.hydrateStoredQuestionCore(question),
    );

    return {
      id: row.id,
      candidateName: row.candidate_name,
      position: row.position,
      questions,
      answers: (row.answers_json ?? []).map((answer) =>
        this.normalizeAnswer(answer, questions),
      ),
      status: row.status,
      result: this.normalizeResult(row.result_json),
      workflow: this.normalizeWorkflow(
        row.workflow_json,
        row.status,
        row.updated_at,
      ),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private normalizeAnswer(
    rawAnswer: Record<string, unknown>,
    questions: InterviewQuestion[],
  ): Answer {
    const questionIndex = this.asNumber(rawAnswer.questionIndex) ?? 0;
    const uploadedAt = this.asDate(rawAnswer.uploadedAt) ?? new Date();
    const mediaKey =
      this.asString(rawAnswer.mediaKey) ??
      this.asString((rawAnswer.camera as Record<string, unknown> | undefined)?.mediaKey) ??
      '';
    const screenMediaKey =
      this.asString(rawAnswer.screenMediaKey) ??
      this.asString((rawAnswer.screen as Record<string, unknown> | undefined)?.mediaKey);
    const questionId =
      this.asString(rawAnswer.questionId) ??
      questions[questionIndex]?.id ??
      `question-${questionIndex}`;
    const versions = this.normalizeAnswerVersions(rawAnswer, mediaKey, screenMediaKey, uploadedAt);
    const latestVersion =
      versions.length > 0 ? versions[versions.length - 1] : undefined;
    const selectedVersionNumber =
      this.asNumber(rawAnswer.selectedVersionNumber) ??
      latestVersion?.versionNumber;
    const selectedVersion =
      versions.find((version) => version.versionNumber === selectedVersionNumber) ??
      latestVersion;

    return {
      questionIndex,
      questionId,
      status:
        (this.asString(rawAnswer.status) as Answer['status'] | undefined) ??
        'submitted',
      mediaKey: selectedVersion?.mediaKey ?? mediaKey,
      screenMediaKey: selectedVersion?.screenMediaKey ?? screenMediaKey,
      uploadedAt: selectedVersion?.uploadedAt ?? uploadedAt,
      durationSeconds:
        selectedVersion?.durationSeconds ??
        this.asNumber(rawAnswer.durationSeconds),
      retakeCount:
        this.asNumber(rawAnswer.retakeCount) ?? Math.max(versions.length - 1, 0),
      startedAt: selectedVersion?.startedAt ?? this.asDate(rawAnswer.startedAt),
      submittedAt:
        selectedVersion?.submittedAt ?? this.asDate(rawAnswer.submittedAt),
      camera:
        selectedVersion?.camera ??
        this.normalizeMediaArtifact(rawAnswer.camera, mediaKey, uploadedAt),
      screen:
        selectedVersion?.screen ??
        this.normalizeMediaArtifact(
          rawAnswer.screen,
          screenMediaKey,
          uploadedAt,
        ),
      behaviorSignals:
        selectedVersion?.behaviorSignals ??
        this.normalizeBehaviorSignals(rawAnswer.behaviorSignals),
      selectedVersionNumber,
      versions,
      behaviorEvents:
        selectedVersion?.behaviorEvents ??
        this.normalizeBehaviorEvents(
          rawAnswer.behaviorEvents,
          selectedVersionNumber ?? 1,
        ),
      transcript: this.normalizeTranscript(rawAnswer.transcript),
      evaluation: this.normalizeEvaluation(rawAnswer.evaluation),
      validation: this.normalizeAnswerValidation(rawAnswer.validation),
    };
  }

  private normalizeAnswerVersions(
    rawAnswer: Record<string, unknown>,
    fallbackMediaKey: string,
    fallbackScreenMediaKey: string | undefined,
    fallbackUploadedAt: Date,
  ): AnswerVersion[] {
    const rawVersions = Array.isArray(rawAnswer.versions)
      ? rawAnswer.versions
      : [];

    const normalizedVersions = rawVersions
      .map((version) => this.asRecord(version))
      .filter((version): version is Record<string, unknown> => Boolean(version))
      .map((version) => this.normalizeAnswerVersion(version, fallbackUploadedAt))
      .filter((version): version is AnswerVersion => Boolean(version));

    if (normalizedVersions.length > 0) {
      return normalizedVersions.sort(
        (left, right) => left.versionNumber - right.versionNumber,
      );
    }

    if (!fallbackMediaKey) {
      return [];
    }

    return [
      {
        versionNumber: 1,
        mediaKey: fallbackMediaKey,
        screenMediaKey: fallbackScreenMediaKey,
        uploadedAt: fallbackUploadedAt,
        durationSeconds: this.asNumber(rawAnswer.durationSeconds),
        startedAt: this.asDate(rawAnswer.startedAt),
        submittedAt: this.asDate(rawAnswer.submittedAt),
        camera: this.normalizeMediaArtifact(
          rawAnswer.camera,
          fallbackMediaKey,
          fallbackUploadedAt,
        ),
        screen: this.normalizeMediaArtifact(
          rawAnswer.screen,
          fallbackScreenMediaKey,
          fallbackUploadedAt,
        ),
        behaviorSignals: this.normalizeBehaviorSignals(rawAnswer.behaviorSignals),
        behaviorEvents: this.normalizeBehaviorEvents(
          rawAnswer.behaviorEvents,
          1,
        ),
      },
    ];
  }

  private normalizeAnswerVersion(
    rawVersion: Record<string, unknown>,
    fallbackUploadedAt: Date,
  ): AnswerVersion | undefined {
    const mediaKey = this.asString(rawVersion.mediaKey);
    if (!mediaKey) {
      return undefined;
    }

    return {
      versionNumber: this.asNumber(rawVersion.versionNumber) ?? 1,
      mediaKey,
      screenMediaKey: this.asString(rawVersion.screenMediaKey),
      uploadedAt:
        this.asDate(rawVersion.uploadedAt) ?? new Date(fallbackUploadedAt),
      durationSeconds: this.asNumber(rawVersion.durationSeconds),
      startedAt: this.asDate(rawVersion.startedAt),
      submittedAt: this.asDate(rawVersion.submittedAt),
      camera: this.normalizeMediaArtifact(
        rawVersion.camera,
        mediaKey,
        fallbackUploadedAt,
      ),
      screen: this.normalizeMediaArtifact(
        rawVersion.screen,
        this.asString(rawVersion.screenMediaKey),
        fallbackUploadedAt,
      ),
      behaviorSignals: this.normalizeBehaviorSignals(rawVersion.behaviorSignals),
      behaviorEvents: this.normalizeBehaviorEvents(
        rawVersion.behaviorEvents,
        this.asNumber(rawVersion.versionNumber) ?? 1,
      ),
    };
  }

  private normalizeMediaArtifact(
    value: unknown,
    fallbackMediaKey: string | undefined,
    fallbackUploadedAt: Date,
  ): MediaArtifact | undefined {
    const rawArtifact = this.asRecord(value);
    const mediaKey =
      this.asString(rawArtifact?.mediaKey) ??
      (fallbackMediaKey?.trim() ? fallbackMediaKey.trim() : undefined);

    if (!mediaKey) {
      return undefined;
    }

    return {
      mediaKey,
      contentType: this.asString(rawArtifact?.contentType) ?? 'video/webm',
      fileSizeBytes: this.asNumber(rawArtifact?.fileSizeBytes),
      uploadedAt:
        this.asDate(rawArtifact?.uploadedAt) ?? new Date(fallbackUploadedAt),
    };
  }

  private normalizeBehaviorSignals(value: unknown): AnswerBehaviorSignals {
    const rawSignals = this.asRecord(value);

    return {
      tabHiddenCount: this.asNumber(rawSignals?.tabHiddenCount) ?? 0,
      windowBlurCount: this.asNumber(rawSignals?.windowBlurCount) ?? 0,
      pasteCount: this.asNumber(rawSignals?.pasteCount) ?? 0,
      keydownCount: this.asNumber(rawSignals?.keydownCount) ?? 0,
      resizeCount: this.asNumber(rawSignals?.resizeCount) ?? 0,
    };
  }

  private normalizeBehaviorEvents(
    value: unknown,
    fallbackVersionNumber: number,
  ): AnswerBehaviorEvent[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((event) => this.asRecord(event))
      .filter((event): event is Record<string, unknown> => Boolean(event))
      .map((event) => {
        const eventType = this.asString(event.eventType) as
          | AnswerBehaviorEvent['eventType']
          | undefined;
        const occurredAt = this.asDate(event.occurredAt);

        if (!eventType || !occurredAt) {
          return undefined;
        }

        return {
          eventType,
          occurredAt,
          versionNumber:
            this.asNumber(event.versionNumber) ?? fallbackVersionNumber,
        };
      })
      .filter((event): event is AnswerBehaviorEvent => Boolean(event));
  }

  private mergeBehaviorSignals(
    existingSignals: AnswerBehaviorSignals | undefined,
    nextSignals: AnswerBehaviorSignals | undefined,
  ): AnswerBehaviorSignals {
    if (!nextSignals) {
      return existingSignals
        ? this.normalizeBehaviorSignals(existingSignals)
        : this.normalizeBehaviorSignals(undefined);
    }

    return this.normalizeBehaviorSignals(nextSignals);
  }

  private buildBehaviorEventsSnapshot(
    existingEvents: AnswerBehaviorEvent[] | undefined,
    nextEvents: AnswerBehaviorEvent[] | undefined,
    fallbackVersionNumber: number,
    mergeEvents: boolean,
  ): AnswerBehaviorEvent[] {
    const normalizedNextEvents = this.normalizeBehaviorEvents(
      nextEvents,
      fallbackVersionNumber,
    );

    if (!mergeEvents) {
      return normalizedNextEvents;
    }

    return this.mergeBehaviorEvents(existingEvents ?? [], normalizedNextEvents);
  }

  private mergeBehaviorEvents(
    existingEvents: AnswerBehaviorEvent[],
    nextEvents: AnswerBehaviorEvent[],
  ): AnswerBehaviorEvent[] {
    const byKey = new Map<string, AnswerBehaviorEvent>();

    [...existingEvents, ...nextEvents].forEach((event) => {
      const key = `${event.versionNumber}:${event.eventType}:${event.occurredAt.toISOString()}`;
      byKey.set(key, event);
    });

    return [...byKey.values()].sort(
      (left, right) => left.occurredAt.getTime() - right.occurredAt.getTime(),
    );
  }

  private resolveSubmittedAt({
    submittedAt,
    uploadedAt,
    existingVersion,
    fallback,
  }: {
    submittedAt?: Date;
    uploadedAt: Date;
    existingVersion?: AnswerVersion;
    fallback: 'now' | 'keep';
  }): Date | undefined {
    if (submittedAt && !Number.isNaN(submittedAt.getTime())) {
      return submittedAt;
    }

    if (existingVersion?.submittedAt) {
      return existingVersion.submittedAt;
    }

    return fallback === 'now' ? uploadedAt : undefined;
  }

  private normalizeTranscript(value: unknown): AnswerTranscript | undefined {
    const rawTranscript = this.asRecord(value);
    if (!rawTranscript) {
      return undefined;
    }

    const text = this.asString(rawTranscript.text);
    const language = this.asString(rawTranscript.language);
    const provider = this.asString(rawTranscript.provider);
    const generatedAt = this.asDate(rawTranscript.generatedAt);

    if (!text && !language && !provider && !generatedAt) {
      return undefined;
    }

    return {
      text,
      language,
      provider,
      generatedAt,
    };
  }

  private normalizeEvaluation(value: unknown): AnswerEvaluation | undefined {
    const rawEvaluation = this.asRecord(value);
    if (!rawEvaluation) {
      return undefined;
    }

    const overallScore = this.asNumber(rawEvaluation.overallScore);
    const categoryScores = this.asNumberRecord(rawEvaluation.categoryScores);
    const coveredConceptIds = this.asStringArray(rawEvaluation.coveredConceptIds);
    const missedConceptIds = this.asStringArray(rawEvaluation.missedConceptIds);
    const redFlagIds = this.asStringArray(rawEvaluation.redFlagIds);
    const behaviorRisk = this.asString(rawEvaluation.behaviorRisk) as
      | AnswerEvaluation['behaviorRisk']
      | undefined;
    const summary = this.asString(rawEvaluation.summary);
    const decisionHint = this.asString(rawEvaluation.decisionHint) as
      | AnswerEvaluation['decisionHint']
      | undefined;
    const evaluatedAt = this.asDate(rawEvaluation.evaluatedAt);

    if (
      overallScore === undefined &&
      Object.keys(categoryScores).length === 0 &&
      coveredConceptIds.length === 0 &&
      missedConceptIds.length === 0 &&
      redFlagIds.length === 0 &&
      !behaviorRisk &&
      !summary &&
      !decisionHint &&
      !evaluatedAt
    ) {
      return undefined;
    }

    return {
      overallScore,
      categoryScores,
      coveredConceptIds,
      missedConceptIds,
      redFlagIds,
      behaviorRisk,
      summary,
      decisionHint,
      evaluatedAt,
    };
  }

  private normalizeAnswerValidation(
    value: unknown,
  ): AnswerValidation | undefined {
    const rawValidation = this.asRecord(value);
    if (!rawValidation) {
      return undefined;
    }

    const status = this.asString(rawValidation.status) as
      | AnswerValidation['status']
      | undefined;
    const executionArn = this.asString(rawValidation.executionArn);
    const sourceVersionNumber = this.asNumber(
      rawValidation.sourceVersionNumber,
    );
    const requestedAt = this.asDate(rawValidation.requestedAt);
    const startedAt = this.asDate(rawValidation.startedAt);
    const completedAt = this.asDate(rawValidation.completedAt);
    const errorMessage = this.asString(rawValidation.errorMessage);

    if (
      !status &&
      !executionArn &&
      sourceVersionNumber === undefined &&
      !requestedAt &&
      !startedAt &&
      !completedAt &&
      !errorMessage
    ) {
      return undefined;
    }

    return {
      status: status ?? 'idle',
      executionArn,
      sourceVersionNumber,
      requestedAt,
      startedAt,
      completedAt,
      errorMessage,
    };
  }

  private normalizeResult(
    value: Record<string, unknown> | null,
  ): InterviewResult | undefined {
    const rawResult = this.asRecord(value);
    if (!rawResult) {
      return undefined;
    }

    return {
      overallScore: this.asNumber(rawResult.overallScore) ?? 0,
      summary: this.asString(rawResult.summary) ?? '',
      categoryScores: this.asNumberRecord(rawResult.categoryScores),
      rubricVersion: this.asString(rawResult.rubricVersion),
      decision: this.asString(rawResult.decision) as
        | InterviewResult['decision']
        | undefined,
      trustScore: this.asNumber(rawResult.trustScore),
      trustFlags: this.asStringArray(rawResult.trustFlags),
      behaviorSummary: this.normalizeBehaviorSummary(rawResult.behaviorSummary),
      questionResults: this.normalizeQuestionResults(rawResult.questionResults),
      completedAt: this.asDate(rawResult.completedAt) ?? new Date(),
    };
  }

  private normalizeBehaviorSummary(
    value: unknown,
  ): InterviewResult['behaviorSummary'] {
    const rawSummary = this.asRecord(value);
    if (!rawSummary) {
      return undefined;
    }

    return {
      riskLevel: this.asString(rawSummary.riskLevel) as
        | 'low'
        | 'medium'
        | 'high'
        | undefined,
      notes: this.asStringArray(rawSummary.notes),
    };
  }

  private normalizeQuestionResults(value: unknown): InterviewQuestionResult[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => this.asRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => ({
        questionIndex: this.asNumber(item.questionIndex) ?? 0,
        questionId: this.asString(item.questionId) ?? '',
        score: this.asNumber(item.score),
        categoryScores: this.asNumberRecord(item.categoryScores),
        summary: this.asString(item.summary),
        decisionHint: this.asString(item.decisionHint) as
          | InterviewQuestionResult['decisionHint']
          | undefined,
      }));
  }

  private normalizeWorkflow(
    value: Record<string, unknown> | null,
    interviewStatus: Interview['status'],
    updatedAt: Date,
  ): InterviewWorkflow {
    const rawWorkflow = this.asRecord(value);
    if (!rawWorkflow) {
      return this.buildWorkflow(
        this.deriveWorkflowStatus(interviewStatus),
        new Date(updatedAt),
      );
    }

    return {
      status:
        (this.asString(rawWorkflow.status) as InterviewWorkflow['status']) ??
        this.deriveWorkflowStatus(interviewStatus),
      currentStage: this.asString(rawWorkflow.currentStage) as
        | InterviewWorkflow['currentStage']
        | undefined,
      executionId: this.asString(rawWorkflow.executionId),
      startedAt: this.asDate(rawWorkflow.startedAt),
      completedAt: this.asDate(rawWorkflow.completedAt),
      lastUpdatedAt:
        this.asDate(rawWorkflow.lastUpdatedAt) ?? new Date(updatedAt),
      errorMessage: this.asString(rawWorkflow.errorMessage),
    };
  }

  private buildWorkflow(
    status: InterviewWorkflow['status'],
    timestamp: Date,
    overrides: Partial<InterviewWorkflow> = {},
  ): InterviewWorkflow {
    return {
      status,
      lastUpdatedAt: timestamp,
      ...overrides,
    };
  }

  private buildMediaArtifact({
    mediaKey,
    uploadedAt,
    fileSizeBytes,
  }: {
    mediaKey: string;
    uploadedAt: Date;
    fileSizeBytes?: number;
  }): MediaArtifact {
    return {
      mediaKey,
      contentType: 'video/webm',
      fileSizeBytes,
      uploadedAt,
    };
  }

  private deriveWorkflowStatus(
    interviewStatus: Interview['status'],
  ): InterviewWorkflow['status'] {
    switch (interviewStatus) {
      case 'processing':
        return 'processing';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      default:
        return 'idle';
    }
  }

  private getSubmittedAnswerCount(interview: Interview): number {
    return interview.answers.filter((answer) => answer.status === 'submitted')
      .length;
  }

  private getAnswerVersions(answer?: Answer): AnswerVersion[] {
    if (!answer) {
      return [];
    }

    if (answer.versions?.length) {
      return [...answer.versions];
    }

    return [
      {
        versionNumber: answer.selectedVersionNumber ?? 1,
        mediaKey: answer.mediaKey,
        screenMediaKey: answer.screenMediaKey,
        uploadedAt: answer.uploadedAt,
        durationSeconds: answer.durationSeconds,
        startedAt: answer.startedAt,
        submittedAt: answer.submittedAt,
        camera: answer.camera,
        screen: answer.screen,
        behaviorSignals: answer.behaviorSignals,
        behaviorEvents: answer.behaviorEvents,
      },
    ];
  }

  private asRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      return undefined;
    }

    return value as Record<string, unknown>;
  }

  private asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private asNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : undefined;
  }

  private normalizePositiveNumber(value: unknown): number | undefined {
    const numericValue = this.asNumber(value);
    return numericValue !== undefined && numericValue > 0
      ? numericValue
      : undefined;
  }

  private asDate(value: unknown): Date | undefined {
    if (!value) {
      return undefined;
    }

    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private asStringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private asNumberRecord(value: unknown): Record<string, number> {
    const rawRecord = this.asRecord(value);
    if (!rawRecord) {
      return {};
    }

    return Object.entries(rawRecord).reduce<Record<string, number>>(
      (accumulator, [key, itemValue]) => {
        if (typeof itemValue === 'number' && Number.isFinite(itemValue)) {
          accumulator[key] = itemValue;
        }
        return accumulator;
      },
      {},
    );
  }
}
