import {
  BadRequestException, ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { QuestionService } from '../question/question.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { UpdateInterviewDto } from './dto/update-interview.dto';
import { UserRole } from '../user/interfaces/user.interface';
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
  InterviewBehaviorRisk,
  InterviewDecision,
  InterviewQuestion,
  InterviewResult,
  InterviewQuestionResult,
  InterviewWorkflow,
  MediaArtifact,
} from './interfaces/interview.interface';
import { compareBehaviorRisk } from './answer-behavior-risk';
import {
  getInterviewCompletionBlockReason,
  getSubmittedAnswerCount as countSubmittedAnswers,
} from './interview-completion-rules';
import { getInterviewResultsUnavailableMessage } from './interview-results-rules';
import {
  getInterviewAccessDenialReason,
  INTERVIEW_ACCESS_DENIED_MESSAGE,
} from './interview-access-rules';
import { getInterviewPendingOnlyBlockReason, isTerminalInterviewStatus } from './interview-management-rules';

interface InterviewRow {
  id: string;
  candidate_name: string;
  candidate_email: string | null;
  position: string;
  questions_json: InterviewQuestion[] | null;
  answers_json: Record<string, unknown>[] | null;
  status: Interview['status'];
  result_json: Record<string, unknown> | null;
  workflow_json: Record<string, unknown> | null;
  created_by_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface InterviewActor {
  id: string;
  role: UserRole;
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
  clientTranscript?: AnswerTranscript;
}

interface QueueAnswerValidationInput {
  questionIndex: number;
  sourceVersionNumber: number;
  runId: string;
  executionArn?: string;
  requestedAt: Date;
}

interface CompleteAnswerValidationInput {
  questionIndex: number;
  sourceVersionNumber: number;
  runId: string;
  requestedAt: Date;
  executionArn?: string;
  transcript?: AnswerTranscript;
  evaluation?: AnswerEvaluation;
  completedAt: Date;
}

interface FailAnswerValidationInput {
  questionIndex: number;
  sourceVersionNumber?: number;
  runId?: string;
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

  async create(
    dto: CreateInterviewDto,
    context: { createdById?: string } = {},
  ): Promise<Interview> {
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

    return this.databaseService.withTransaction(async (client) => {
      const questions = await this.questionService.findManyByIdsForUpdate(
        client,
        questionIds,
      );

      if (questions.length !== questionIds.length) {
        throw new BadRequestException(
          `Resolved ${questions.length} questions for ${questionIds.length} requested ids; interview cannot be created.`,
        );
      }

      const result = await client.query<InterviewRow>(
        `
          INSERT INTO interviews (
            id,
            candidate_name,
            candidate_email,
            position,
            questions_json,
            answers_json,
            status,
            workflow_json,
            created_by_id
          )
          VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8::jsonb, $9)
          RETURNING
            id,
            candidate_name,
            candidate_email,
            position,
            questions_json,
            answers_json,
            status,
            result_json,
            workflow_json,
            created_by_id,
            created_at,
            updated_at
        `,
        [
          randomUUID(),
          candidateName,
          dto.candidateEmail?.trim().toLowerCase() || null,
          position,
          JSON.stringify(questions),
          JSON.stringify([]),
          'pending',
          JSON.stringify(this.buildWorkflow('idle', new Date())),
          context.createdById ?? null,
        ],
      );

      await client.query(
        `UPDATE questions SET usage_count = usage_count + 1 WHERE id = ANY($1::uuid[])`,
        [questionIds],
      );

      return this.mapRow(result.rows[0]);
    });
  }

  async cancel(id: string): Promise<Interview> {
    return this.databaseService.withTransaction(async (client) => {
      const row = await this.lockInterviewForUpdate(client, id);
      const interview = this.mapRow(row);

      const blockReason = getInterviewPendingOnlyBlockReason(interview.status);
      if (blockReason) {
        throw new ConflictException(blockReason);
      }

      const now = new Date();
      const canceled: Interview = {
        ...interview,
        status: 'canceled',
        workflow: this.buildWorkflow('idle', now, { completedAt: now }),
        updatedAt: now,
      };

      const saved = await this.saveInterviewInTransaction(client, canceled);
      await this.questionService.processPendingDeletionsAfterTerminalInterview(client);
      return saved;
    });
  }

  async update(id: string, dto: UpdateInterviewDto): Promise<Interview> {
    const hasUpdates =
      dto.candidateName !== undefined ||
      dto.candidateEmail !== undefined ||
      dto.position !== undefined ||
      dto.questionIds !== undefined;

    if (!hasUpdates) {
      throw new BadRequestException('At least one field must be provided');
    }

    return this.databaseService.withTransaction(async (client) => {
      const row = await this.lockInterviewForUpdate(client, id);
      const interview = this.mapRow(row);

      const blockReason = getInterviewPendingOnlyBlockReason(interview.status);
      if (blockReason) {
        throw new ConflictException(blockReason);
      }

      let candidateName = interview.candidateName;
      let candidateEmail = interview.candidateEmail;
      let position = interview.position;
      let questions = interview.questions;

      if (dto.candidateName !== undefined) {
        candidateName = dto.candidateName.trim();
        if (!candidateName) {
          throw new BadRequestException('Candidate name is required');
        }
      }

      if (dto.position !== undefined) {
        position = dto.position.trim();
        if (!position) {
          throw new BadRequestException('Position is required');
        }
      }

      if (dto.candidateEmail !== undefined) {
        candidateEmail = dto.candidateEmail.trim().toLowerCase() || undefined;
      }

      if (dto.questionIds !== undefined) {
        const questionIds = dto.questionIds
          .map((questionId) => questionId.trim())
          .filter(Boolean);

        if (questionIds.length === 0) {
          throw new BadRequestException('At least one question must be selected');
        }

        const nextQuestions = await this.questionService.findManyByIdsForUpdate(
          client,
          questionIds,
        );

        if (nextQuestions.length !== questionIds.length) {
          throw new BadRequestException(
            `Resolved ${nextQuestions.length} questions for ${questionIds.length} requested ids; interview cannot be updated.`,
          );
        }

        const oldIds = interview.questions.map((question) => question.id);
        const added = questionIds.filter((questionId) => !oldIds.includes(questionId));
        const removed = oldIds.filter((questionId) => !questionIds.includes(questionId));

        if (added.length > 0) {
          await client.query(
            `UPDATE questions SET usage_count = usage_count + 1 WHERE id = ANY($1::uuid[])`,
            [added],
          );
        }

        if (removed.length > 0) {
          await client.query(
            `UPDATE questions SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = ANY($1::uuid[])`,
            [removed],
          );
        }

        questions = nextQuestions;
      }

      const updated: Interview = {
        ...interview,
        candidateName,
        candidateEmail,
        position,
        questions,
        updatedAt: new Date(),
      };

      return this.saveInterviewInTransaction(client, updated);
    });
  }

  async findAll(): Promise<Interview[]> {
    const result = await this.databaseService.query<InterviewRow>(
      `
        SELECT
          id,
          candidate_name,
          candidate_email,
          position,
          questions_json,
          answers_json,
          status,
          result_json,
          workflow_json,
          created_by_id,
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
          candidate_email,
          position,
          questions_json,
          answers_json,
          status,
          result_json,
          workflow_json,
          created_by_id,
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

  async findAllForActor(actor: InterviewActor): Promise<Interview[]> {
    if (actor.role === 'super_admin' || actor.role === 'admin') {
      return this.findAll();
    }
    if (actor.role === 'hr') {
      const result = await this.databaseService.query<InterviewRow>(
        `
          SELECT
            id,
            candidate_name,
            candidate_email,
            position,
            questions_json,
            answers_json,
            status,
            result_json,
            workflow_json,
            created_by_id,
            created_at,
            updated_at
          FROM interviews
          WHERE created_by_id = $1
          ORDER BY created_at DESC
        `,
        [actor.id],
      );
      return result.rows.map((row) => this.mapRow(row));
    }
    throw new ForbiddenException('You do not have access to interviews');
  }

  async findOneForActor(id: string, actor: InterviewActor): Promise<Interview> {
    const interview = await this.findOne(id);
    this.assertActorCanAccess(interview, actor);
    return interview;
  }

  async complete(id: string): Promise<Interview> {
    const interview = await this.findOne(id);
    const blockReason = getInterviewCompletionBlockReason(interview);
    if (blockReason) {
      throw new BadRequestException(blockReason);
    }

    return this.recomputeResult(id);
  }

  async getResults(id: string): Promise<InterviewResult> {
    const interview = await this.findOne(id);
    const unavailableMessage = getInterviewResultsUnavailableMessage(
      interview,
      id,
    );
    if (unavailableMessage) {
      throw new NotFoundException(unavailableMessage);
    }
    return interview.result!;
  }

  private assertActorCanAccess(
    interview: Interview,
    actor: InterviewActor,
  ): void {
    const denial = getInterviewAccessDenialReason(interview, actor);
    if (denial) {
      throw new ForbiddenException(INTERVIEW_ACCESS_DENIED_MESSAGE);
    }
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
    return this.queueAnswerValidations(id, [input]);
  }

  async queueAnswerValidations(
    id: string,
    inputs: QueueAnswerValidationInput[],
  ): Promise<Interview> {
    if (inputs.length === 0) {
      throw new Error('queueAnswerValidations requires at least one input.');
    }

    const interview = await this.findOne(id);
    const inputByIndex = new Map(
      inputs.map((input) => [input.questionIndex, input]),
    );

    inputByIndex.forEach((_value, questionIndex) =>
      this.requireAnswer(interview, questionIndex),
    );

    const stamps = inputs.map((input) => new Date(input.requestedAt));
    const earliest = stamps.reduce((acc, candidate) =>
      candidate.getTime() < acc.getTime() ? candidate : acc,
    );

    const updatedAnswers = interview.answers.map((answer) => {
      const input = inputByIndex.get(answer.questionIndex);
      if (!input) return answer;
      const stamp = new Date(input.requestedAt);
      return {
        ...answer,
        validation: {
          status: 'queued' as const,
          executionArn: input.executionArn,
          sourceVersionNumber: input.sourceVersionNumber,
          runId: input.runId,
          requestedAt: stamp,
          startedAt: stamp,
          errorMessage: undefined,
        },
      };
    });

    return this.saveInterview({
      ...interview,
      answers: updatedAnswers,
      status: 'processing',
      workflow: this.buildWorkflow('processing', earliest, {
        currentStage: 'validate_answers',
        startedAt: interview.workflow?.startedAt ?? earliest,
        errorMessage: undefined,
      }),
      updatedAt: earliest,
    });
  }

  async completeAnswerValidation(
    id: string,
    input: CompleteAnswerValidationInput,
  ): Promise<Interview> {
    const interview = await this.findOne(id);
    const answer = this.requireAnswer(interview, input.questionIndex);

    if (this.isStaleValidationWrite(answer, input.runId)) {
      return interview;
    }

    const nextAnswer: Answer = {
      ...answer,
      transcript: this.mergeTranscript(answer.transcript, input.transcript),
      evaluation: input.evaluation ?? answer.evaluation,
      validation: {
        status: 'completed',
        executionArn:
          input.executionArn ?? answer.validation?.executionArn,
        sourceVersionNumber: input.sourceVersionNumber,
        runId: input.runId,
        requestedAt:
          answer.validation?.requestedAt ?? input.completedAt,
        startedAt:
          answer.validation?.startedAt ?? input.completedAt,
        completedAt: input.completedAt,
      },
    };

    const withUpdatedAnswer: Interview = {
      ...interview,
      answers: interview.answers.map((item) =>
        item.questionIndex === nextAnswer.questionIndex ? nextAnswer : item,
      ),
      updatedAt: new Date(),
    };

    const next = this.applyResultRecomputation(withUpdatedAnswer);
    return this.saveInterviewWithTerminalSideEffects(interview.status, next);
  }

  private isStaleValidationWrite(
    answer: Answer,
    inputRunId: string | undefined,
  ): boolean {
    if (!inputRunId) return false;
    const existingRunId = answer.validation?.runId;
    if (!existingRunId) {
      const existingStatus = answer.validation?.status;
      return existingStatus !== 'queued' && existingStatus !== 'processing';
    }
    return existingRunId !== inputRunId;
  }

  async failAnswerValidation(
    id: string,
    input: FailAnswerValidationInput,
  ): Promise<Interview> {
    const interview = await this.findOne(id);
    const answer = this.requireAnswer(interview, input.questionIndex);

    if (this.isStaleValidationWrite(answer, input.runId)) {
      return interview;
    }

    const nextAnswer: Answer = {
      ...answer,
      validation: {
        status: 'failed',
        executionArn:
          input.executionArn ?? answer.validation?.executionArn,
        sourceVersionNumber:
          input.sourceVersionNumber ?? answer.validation?.sourceVersionNumber,
        runId: input.runId ?? answer.validation?.runId,
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

    const now = new Date(input.completedAt);
    const updatedAnswers = interview.answers.map((item) =>
      item.questionIndex === nextAnswer.questionIndex ? nextAnswer : item,
    );

    const submittedAnswers = updatedAnswers.filter((a) => a.status === 'submitted');
    const allFailed =
      submittedAnswers.length > 0 &&
      submittedAnswers.every((a) => a.validation?.status === 'failed');

    const nextStatus = allFailed ? 'failed' : interview.status;
    const nextWorkflow = allFailed
      ? this.buildWorkflow('failed', now, {
          currentStage: 'analyze_answers',
          startedAt:
            answer.validation?.startedAt ??
            answer.validation?.requestedAt ??
            now,
          completedAt: now,
          errorMessage: nextAnswer.validation?.errorMessage,
        })
      : interview.workflow;

    const next = this.applyResultRecomputation({
      ...interview,
      answers: updatedAnswers,
      status: nextStatus,
      workflow: nextWorkflow,
      updatedAt: now,
    });
    return this.saveInterviewWithTerminalSideEffects(interview.status, next);
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
    let normalizedSubmittedAt = this.resolveSubmittedAt({
      submittedAt,
      uploadedAt,
      existingVersion,
      fallback: options.submittedAtFallback,
    });

    if (
      !submitAnswer &&
      normalizedStartedAt &&
      normalizedSubmittedAt &&
      normalizedSubmittedAt.getTime() < normalizedStartedAt.getTime()
    ) {
      normalizedSubmittedAt = undefined;
    }

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
    const shouldCarryTranscriptFromPreviousVersion =
      existingAnswer?.selectedVersionNumber === selectedVersionNumber;

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
      transcript: clientTranscript
        ? this.normalizeTranscript(clientTranscript)
        : shouldCarryTranscriptFromPreviousVersion
          ? existingAnswer?.transcript
          : undefined,
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

  private async lockInterviewForUpdate(
    client: PoolClient,
    id: string,
  ): Promise<InterviewRow> {
    const result = await client.query<InterviewRow>(
      `
        SELECT
          id,
          candidate_name,
          candidate_email,
          position,
          questions_json,
          answers_json,
          status,
          result_json,
          workflow_json,
          created_by_id,
          created_at,
          updated_at
        FROM interviews
        WHERE id = $1
        FOR UPDATE
      `,
      [id],
    );

    if (!result.rows[0]) {
      throw new NotFoundException(`Interview with id "${id}" not found`);
    }

    return result.rows[0];
  }

  private async saveInterviewInTransaction(
    client: PoolClient,
    interview: Interview,
  ): Promise<Interview> {
    const result = await client.query<InterviewRow>(
      `
        UPDATE interviews
        SET
          candidate_name = $2,
          candidate_email = $3,
          position = $4,
          questions_json = $5::jsonb,
          answers_json = $6::jsonb,
          status = $7,
          result_json = $8::jsonb,
          workflow_json = $9::jsonb,
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          candidate_name,
          candidate_email,
          position,
          questions_json,
          answers_json,
          status,
          result_json,
          workflow_json,
          created_by_id,
          created_at,
          updated_at
      `,
      [
        interview.id,
        interview.candidateName,
        interview.candidateEmail ?? null,
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

  private async saveInterviewWithTerminalSideEffects(
    previousStatus: Interview['status'],
    interview: Interview,
  ): Promise<Interview> {
    const becameTerminal =
      !isTerminalInterviewStatus(previousStatus) &&
      isTerminalInterviewStatus(interview.status);

    if (!becameTerminal) {
      return this.saveInterview(interview);
    }

    return this.databaseService.withTransaction(async (client) => {
      await this.lockInterviewForUpdate(client, interview.id);
      const saved = await this.saveInterviewInTransaction(client, interview);
      await this.questionService.processPendingDeletionsAfterTerminalInterview(
        client,
      );
      return saved;
    });
  }

  private async saveInterview(interview: Interview): Promise<Interview> {
    const result = await this.databaseService.query<InterviewRow>(
      `
        UPDATE interviews
        SET
          candidate_name = $2,
          candidate_email = $3,
          position = $4,
          questions_json = $5::jsonb,
          answers_json = $6::jsonb,
          status = $7,
          result_json = $8::jsonb,
          workflow_json = $9::jsonb,
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          candidate_name,
          candidate_email,
          position,
          questions_json,
          answers_json,
          status,
          result_json,
          workflow_json,
          created_by_id,
          created_at,
          updated_at
      `,
      [
        interview.id,
        interview.candidateName,
        interview.candidateEmail ?? null,
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

  async recomputeResult(id: string): Promise<Interview> {
    const interview = await this.findOne(id);
    const next = this.applyResultRecomputation(interview);
    if (next === interview) {
      return interview;
    }
    return this.saveInterviewWithTerminalSideEffects(interview.status, next);
  }

  private applyResultRecomputation(interview: Interview): Interview {
    const submittedAnswers = interview.answers.filter(
      (answer) => answer.status === 'submitted',
    );
    const evaluatedAnswers = submittedAnswers.filter(
      (answer) => answer.evaluation && typeof answer.evaluation.overallScore === 'number',
    );

    if (evaluatedAnswers.length === 0) {
      return interview;
    }

    const questionsByIndex = new Map(
      interview.questions.map((question, index) => [index, question]),
    );

    let totalWeight = 0;
    let weightedScore = 0;
    const categorySums: Record<string, { weight: number; total: number }> = {};
    let maxRisk: InterviewBehaviorRisk = 'low';
    const questionResults: InterviewQuestionResult[] = [];

    for (const answer of evaluatedAnswers) {
      const evaluation = answer.evaluation;
      if (!evaluation || typeof evaluation.overallScore !== 'number') {
        continue;
      }

      const question = questionsByIndex.get(answer.questionIndex);
      const weight =
        typeof question?.weight === 'number' && question.weight > 0
          ? question.weight
          : 1;

      totalWeight += weight;
      weightedScore += evaluation.overallScore * weight;

      if (evaluation.categoryScores) {
        for (const [key, value] of Object.entries(evaluation.categoryScores)) {
          if (typeof value !== 'number' || !Number.isFinite(value)) {
            continue;
          }
          const bucket =
            categorySums[key] ?? { weight: 0, total: 0 };
          bucket.weight += weight;
          bucket.total += value * weight;
          categorySums[key] = bucket;
        }
      }

      if (
        evaluation.behaviorRisk &&
        compareBehaviorRisk(evaluation.behaviorRisk, maxRisk) > 0
      ) {
        maxRisk = evaluation.behaviorRisk;
      }

      questionResults.push({
        questionIndex: answer.questionIndex,
        questionId: answer.questionId,
        score: evaluation.overallScore,
        categoryScores: evaluation.categoryScores,
        summary: evaluation.summary,
        decisionHint: evaluation.decisionHint,
      });
    }

    const overallScore =
      totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

    const categoryScores: Record<string, number> = {};
    for (const [key, { weight, total }] of Object.entries(categorySums)) {
      if (weight > 0) {
        categoryScores[key] = Math.round(total / weight);
      }
    }

    const decision = this.computeInterviewDecision(overallScore, maxRisk);
    const summary = this.buildInterviewSummary(questionResults);
    const trustScore = this.riskToTrustScore(maxRisk);

    const allAnswered = submittedAnswers.length >= interview.questions.length;
    const terminalAnswers = submittedAnswers.filter(
      (answer) =>
        answer.validation?.status === 'completed' ||
        answer.validation?.status === 'failed',
    );
    const allTerminal = terminalAnswers.length === submittedAnswers.length;
    const isFinal = allAnswered && allTerminal;
    const completedAt = new Date();

    const result: InterviewResult = {
      overallScore,
      summary,
      categoryScores,
      rubricVersion: 'mvp-v1',
      decision,
      trustScore,
      trustFlags: [],
      behaviorSummary: {
        riskLevel: maxRisk,
        notes: [],
      },
      questionResults: questionResults.sort(
        (left, right) => left.questionIndex - right.questionIndex,
      ),
      completedAt,
    };

    return {
      ...interview,
      result,
      status: isFinal ? 'completed' : interview.status,
      workflow: isFinal
        ? this.buildWorkflow('completed', completedAt, {
            currentStage: 'store_result',
            startedAt: interview.workflow?.startedAt,
            completedAt,
          })
        : this.buildWorkflow('processing', completedAt, {
            currentStage: 'analyze_answers',
            startedAt: interview.workflow?.startedAt ?? completedAt,
          }),
      updatedAt: completedAt,
    };
  }

  private computeInterviewDecision(
    overallScore: number,
    riskLevel: InterviewBehaviorRisk,
  ): InterviewDecision {
    if (riskLevel === 'high' || overallScore < 50) {
      return 'reject';
    }
    if (riskLevel === 'medium' || overallScore < 70) {
      return 'review';
    }
    return 'proceed';
  }

  private riskToTrustScore(riskLevel: InterviewBehaviorRisk): number {
    if (riskLevel === 'high') {
      return 40;
    }
    if (riskLevel === 'medium') {
      return 70;
    }
    return 100;
  }

  private buildInterviewSummary(
    questionResults: InterviewQuestionResult[],
  ): string {
    const lines = questionResults
      .map((item) =>
        item.summary
          ? `Q${item.questionIndex + 1}: ${item.summary}`
          : undefined,
      )
      .filter((line): line is string => Boolean(line));

    if (lines.length === 0) {
      return 'No per-question summaries were produced.';
    }
    return lines.join('\n');
  }

  private mapRow(row: InterviewRow): Interview {
    const questions = (row.questions_json ?? []).map((question) =>
      this.questionService.hydrateStoredQuestionCore(question),
    );

    return {
      id: row.id,
      candidateName: row.candidate_name,
      candidateEmail: row.candidate_email ?? undefined,
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
      createdById: row.created_by_id ?? undefined,
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
      copyCount: this.asNumber(rawSignals?.copyCount) ?? 0,
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

  private mergeTranscript(
    existingTranscript: AnswerTranscript | undefined,
    incomingTranscript: AnswerTranscript | undefined,
  ): AnswerTranscript | undefined {
    if (!incomingTranscript) {
      return existingTranscript;
    }

    return this.normalizeTranscript({
      ...(existingTranscript ?? {}),
      ...incomingTranscript,
    });
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
    const isFinal =
      typeof rawTranscript.isFinal === 'boolean'
        ? rawTranscript.isFinal
        : undefined;

    if (!text && !language && !provider && !generatedAt && isFinal === undefined) {
      return undefined;
    }

    return {
      text,
      language,
      provider,
      generatedAt,
      isFinal,
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
    const runId = this.asString(rawValidation.runId);
    const requestedAt = this.asDate(rawValidation.requestedAt);
    const startedAt = this.asDate(rawValidation.startedAt);
    const completedAt = this.asDate(rawValidation.completedAt);
    const errorMessage = this.asString(rawValidation.errorMessage);

    if (
      !status &&
      !executionArn &&
      sourceVersionNumber === undefined &&
      !runId &&
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
      runId,
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
    return countSubmittedAnswers(interview);
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
