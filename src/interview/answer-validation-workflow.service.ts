import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  SFNClient,
  StartExecutionCommand,
} from '@aws-sdk/client-sfn';
import {
  Answer,
  AnswerVersion,
  AnswerValidationStatus,
  InterviewQuestion,
} from './interfaces/interview.interface';
import { InterviewService } from './interview.service';

interface AnswerValidationExecutionAnswer {
  questionIndex: number;
  questionId: string;
  sourceVersionNumber: number;
  mediaKey: string;
  screenMediaKey?: string;
  uploadedAt: Date;
  durationSeconds?: number;
  startedAt?: Date;
  submittedAt?: Date;
  camera?: Answer['camera'];
  screen?: Answer['screen'];
  behaviorSignals?: Answer['behaviorSignals'];
  behaviorEvents?: Answer['behaviorEvents'];
}

interface AnswerValidationExecutionInput {
  interviewId: string;
  candidateName: string;
  position: string;
  questionIndex: number;
  question: InterviewQuestion;
  answer: AnswerValidationExecutionAnswer;
}

export interface StartAnswerValidationResult {
  status: AnswerValidationStatus;
  questionIndex: number;
  sourceVersionNumber: number;
  executionArn?: string;
  reused: boolean;
}

@Injectable()
export class AnswerValidationWorkflowService {
  private readonly sfnClient = new SFNClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
  });

  constructor(private readonly interviewService: InterviewService) {}

  async startValidation(
    interviewId: string,
    questionIndex: number,
  ): Promise<StartAnswerValidationResult> {
    const stateMachineArn =
      process.env.ANSWER_VALIDATION_STATE_MACHINE_ARN?.trim();

    if (!stateMachineArn) {
      throw new ServiceUnavailableException(
        'Answer validation workflow is not configured',
      );
    }

    const interview = await this.interviewService.findOne(interviewId);
    const answer = interview.answers.find(
      (item) => item.questionIndex === questionIndex,
    );

    if (!answer) {
      throw new BadRequestException(
        `Answer for question ${questionIndex} is not available`,
      );
    }

    if (answer.status !== 'submitted') {
      throw new BadRequestException(
        `Question ${questionIndex} must be submitted before validation starts`,
      );
    }

    const selectedVersion = this.resolveSelectedVersion(answer);
    if (!selectedVersion?.mediaKey) {
      throw new BadRequestException(
        `Question ${questionIndex} does not have an uploaded answer media key`,
      );
    }

    const sourceVersionNumber = selectedVersion.versionNumber;
    const existingValidation = answer.validation;
    if (
      existingValidation &&
      existingValidation.sourceVersionNumber === sourceVersionNumber &&
      ['queued', 'processing', 'completed'].includes(existingValidation.status)
    ) {
      return {
        status: existingValidation.status,
        questionIndex,
        sourceVersionNumber,
        executionArn: existingValidation.executionArn,
        reused: true,
      };
    }

    const question = interview.questions[questionIndex];
    if (!question) {
      throw new BadRequestException(
        `Question ${questionIndex} is out of range`,
      );
    }

    const executionInput: AnswerValidationExecutionInput = {
      interviewId: interview.id,
      candidateName: interview.candidateName,
      position: interview.position,
      questionIndex,
      question,
      answer: {
        questionIndex,
        questionId: answer.questionId,
        sourceVersionNumber,
        mediaKey: selectedVersion.mediaKey,
        screenMediaKey: selectedVersion.screenMediaKey,
        uploadedAt: selectedVersion.uploadedAt,
        durationSeconds: selectedVersion.durationSeconds,
        startedAt: selectedVersion.startedAt,
        submittedAt: selectedVersion.submittedAt ?? answer.submittedAt,
        camera: selectedVersion.camera,
        screen: selectedVersion.screen,
        behaviorSignals: selectedVersion.behaviorSignals,
        behaviorEvents: selectedVersion.behaviorEvents,
      },
    };

    const requestedAt = new Date();
    const execution = await this.sfnClient.send(
      new StartExecutionCommand({
        stateMachineArn,
        name: this.buildExecutionName(
          interview.id,
          questionIndex,
          sourceVersionNumber,
          requestedAt,
        ),
        input: JSON.stringify(executionInput),
      }),
    );

    const updatedInterview = await this.interviewService.queueAnswerValidation(
      interview.id,
      {
        questionIndex,
        sourceVersionNumber,
        executionArn: execution.executionArn,
        requestedAt,
      },
    );
    const updatedAnswer = updatedInterview.answers.find(
      (item) => item.questionIndex === questionIndex,
    );

    return {
      status: updatedAnswer?.validation?.status ?? 'queued',
      questionIndex,
      sourceVersionNumber,
      executionArn: execution.executionArn,
      reused: false,
    };
  }

  private resolveSelectedVersion(answer: Answer): AnswerVersion | undefined {
    if (answer.versions?.length) {
      return (
        answer.versions.find(
          (version) =>
            version.versionNumber === (answer.selectedVersionNumber ?? 1),
        ) ?? answer.versions[answer.versions.length - 1]
      );
    }

    if (!answer.mediaKey) {
      return undefined;
    }

    return {
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
    };
  }

  private buildExecutionName(
    interviewId: string,
    questionIndex: number,
    sourceVersionNumber: number,
    requestedAt: Date,
  ): string {
    const normalizedInterviewId = interviewId.replace(/[^A-Za-z0-9_-]/g, '');
    return [
      'answer',
      normalizedInterviewId.slice(0, 32),
      `q${questionIndex}`,
      `v${sourceVersionNumber}`,
      requestedAt.getTime().toString(),
    ].join('-');
  }
}
