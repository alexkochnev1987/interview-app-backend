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
    const uploadedAt = new Date();
    const normalizedSubmittedAt =
      submittedAt && !Number.isNaN(submittedAt.getTime())
        ? submittedAt
        : uploadedAt;
    const normalizedStartedAt =
      startedAt && !Number.isNaN(startedAt.getTime()) ? startedAt : undefined;

    if (
      normalizedStartedAt &&
      normalizedSubmittedAt.getTime() < normalizedStartedAt.getTime()
    ) {
      throw new BadRequestException(
        'submittedAt must be after startedAt for the answer',
      );
    }

    const normalizedVersionNumber =
      typeof versionNumber === 'number' && versionNumber > 0
        ? versionNumber
        : 1;
    const normalizedBehaviorSignals =
      this.normalizeBehaviorSignals(behaviorSignals);
    const normalizedBehaviorEvents =
      this.normalizeBehaviorEvents(behaviorEvents, normalizedVersionNumber);
    const currentVersion: AnswerVersion = {
      versionNumber: normalizedVersionNumber,
      mediaKey,
      screenMediaKey,
      uploadedAt,
      durationSeconds:
        typeof durationSeconds === 'number' && durationSeconds > 0
          ? durationSeconds
          : undefined,
      startedAt: normalizedStartedAt,
      submittedAt: normalizedSubmittedAt,
      camera: this.buildMediaArtifact({
        mediaKey,
        uploadedAt,
        fileSizeBytes: cameraFileSizeBytes,
      }),
      screen: screenMediaKey
        ? this.buildMediaArtifact({
            mediaKey: screenMediaKey,
            uploadedAt,
            fileSizeBytes: screenFileSizeBytes,
          })
        : undefined,
      behaviorSignals: normalizedBehaviorSignals,
      behaviorEvents: normalizedBehaviorEvents,
    };

    const existingAnswer =
      interview.answers.find((answer) => answer.questionIndex === questionIndex) ??
      undefined;
    const existingVersions = this.getAnswerVersions(existingAnswer);
    const nextVersions = [
      ...existingVersions.filter(
        (version) => version.versionNumber !== normalizedVersionNumber,
      ),
      currentVersion,
    ].sort((left, right) => left.versionNumber - right.versionNumber);

    const nextAnswer: Answer = {
      questionIndex,
      questionId: question.id,
      status: submitAnswer ? 'submitted' : 'recording',
      mediaKey,
      screenMediaKey,
      uploadedAt,
      durationSeconds: currentVersion.durationSeconds,
      retakeCount: Math.max(nextVersions.length - 1, 0),
      startedAt: normalizedStartedAt,
      submittedAt: normalizedSubmittedAt,
      camera: currentVersion.camera,
      screen: currentVersion.screen,
      behaviorSignals: normalizedBehaviorSignals,
      selectedVersionNumber: normalizedVersionNumber,
      versions: nextVersions,
      behaviorEvents: normalizedBehaviorEvents,
      transcript: existingAnswer?.transcript,
      evaluation: existingAnswer?.evaluation,
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
