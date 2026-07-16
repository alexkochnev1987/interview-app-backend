import { INestApplication } from '@nestjs/common';

import * as candidateFeedbackLlm from '../../src/ai/llm/candidate-feedback-llm';
import * as candidateFeedbackOverallLlm from '../../src/ai/llm/candidate-feedback-overall-llm';
import { InterviewService } from '../../src/interview/interview.service';
import {
  getIntegrationApp,
  parseCandidateToken,
  type IntegrationAgent,
} from '../helpers/integration-app';
import { authCookie, loginAsSuperAdmin } from '../helpers/integration-auth';
import { buildCreateQuestionPayload } from '../helpers/create-question-payload';
import { useIntegrationHarness } from '../helpers/integration-harness';
import {
  buildSubmitAnswerPayload,
  openCandidateTakeSession,
} from '../helpers/take-flow';

async function createQuestion(
  agent: IntegrationAgent,
  session: string,
  questionText: string,
): Promise<string> {
  const response = await agent
    .post('/questions')
    .set(authCookie(session))
    .send(buildCreateQuestionPayload(questionText))
    .expect(201);

  return response.body.id as string;
}

async function createTwoQuestionCompletedInterview(
  app: INestApplication,
  agent: IntegrationAgent,
  session: string,
  questionIdA: string,
  questionIdB: string,
): Promise<{ interviewId: string; questionIds: [string, string] }> {
  const interviewRes = await agent
    .post('/interviews')
    .set(authCookie(session))
    .send({
      candidateName: 'Candidate Feedback Candidate',
      candidateEmail: 'candidate-feedback@test.local',
      position: 'Integration CF Role',
      questionIds: [questionIdA, questionIdB],
    })
    .expect(201);

  const interviewId = interviewRes.body.id as string;
  const linkRes = await agent
    .post(`/interviews/${interviewId}/candidate-link`)
    .set(authCookie(session))
    .expect(201);
  const token = parseCandidateToken(linkRes.body.candidateLink);

  await openCandidateTakeSession(agent, interviewId, token);
  await agent
    .post(`/take/${interviewId}/answer`)
    .send(buildSubmitAnswerPayload(interviewId, 0, 1))
    .expect(201);
  await agent
    .post(`/take/${interviewId}/answer`)
    .send(buildSubmitAnswerPayload(interviewId, 1, 1))
    .expect(201);

  const interviewService = app.get(InterviewService);
  const completedAt = new Date();

  for (const questionIndex of [0, 1] as const) {
    const runId = `integration-candidate-feedback-q${questionIndex}`;
    await interviewService.queueAnswerValidation(interviewId, {
      questionIndex,
      sourceVersionNumber: 1,
      runId,
      requestedAt: completedAt,
    });
    const interview = await interviewService.completeAnswerValidation(interviewId, {
      questionIndex,
      sourceVersionNumber: 1,
      runId,
      requestedAt: completedAt,
      completedAt,
      transcript: {
        text: `Integration transcript for question ${questionIndex}.`,
        isFinal: true,
      },
      evaluation: {
        overallScore: 80 + questionIndex,
        summary: `Summary for question ${questionIndex}.`,
        evaluatedAt: completedAt,
      },
    });

    if (questionIndex === 1) {
      expect(interview.status).toBe('completed');
    }
  }

  return { interviewId, questionIds: [questionIdA, questionIdB] };
}

describe('Candidate feedback (integration)', () => {
  useIntegrationHarness();

  let questionLlmSpy: jest.SpiedFunction<
    typeof candidateFeedbackLlm.generateCandidateFeedbackQuestionWithNativeLlm
  >;
  let overallLlmSpy: jest.SpiedFunction<
    typeof candidateFeedbackOverallLlm.generateCandidateFeedbackOverallWithNativeLlm
  >;

  beforeEach(() => {
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'integration-test-openai-key';
    questionLlmSpy = jest
      .spyOn(
        candidateFeedbackLlm,
        'generateCandidateFeedbackQuestionWithNativeLlm',
      )
      .mockResolvedValue({
        recommendationText: 'Mock recommendation for Q1.',
        improvementText: 'Mock improvement for Q1.',
      });
    overallLlmSpy = jest
      .spyOn(
        candidateFeedbackOverallLlm,
        'generateCandidateFeedbackOverallWithNativeLlm',
      )
      .mockResolvedValue({
        recommendationText: 'Mock overall recommendation.',
        improvementText: 'Mock overall improvement.',
      });
  });

  afterEach(() => {
    questionLlmSpy.mockRestore();
    overallLlmSpy.mockRestore();
    delete process.env.AI_PROVIDER;
    delete process.env.OPENAI_API_KEY;
  });

  it('covers HR candidate-feedback happy path and preserves locked blocks on generate all', async () => {
    const { app, agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);
    const questionIdA = await createQuestion(
      agent,
      session,
      'Candidate feedback question A.',
    );
    const questionIdB = await createQuestion(
      agent,
      session,
      'Candidate feedback question B.',
    );
    const { interviewId, questionIds } =
      await createTwoQuestionCompletedInterview(
        app,
        agent,
        session,
        questionIdA,
        questionIdB,
      );

    const empty = await agent
      .get(`/interviews/${interviewId}/candidate-feedback`)
      .set(authCookie(session))
      .expect(200);

    expect(empty.body).toMatchObject({
      interviewId,
      overall: { state: 'not_generated' },
    });
    expect(empty.body.questions).toHaveLength(2);
    expect(empty.body.questions[0]).toMatchObject({
      questionIndex: 0,
      questionId: questionIds[0],
      state: 'not_generated',
    });
    expect(empty.body.questions[1]).toMatchObject({
      questionIndex: 1,
      questionId: questionIds[1],
      state: 'not_generated',
    });
    expect(empty.body.updatedAt).toEqual(expect.any(String));

    await agent
      .patch(`/interviews/${interviewId}/candidate-feedback`)
      .set(authCookie(session))
      .send({})
      .expect(400);

    const acceptedQ0 = await agent
      .patch(`/interviews/${interviewId}/candidate-feedback`)
      .set(authCookie(session))
      .send({
        questions: [
          {
            questionIndex: 0,
            recommendationText: 'Accepted Q0 recommendation.',
            improvementText: 'Accepted Q0 improvement.',
            state: 'accepted',
          },
        ],
      })
      .expect(200);

    expect(acceptedQ0.body.questions[0]).toMatchObject({
      questionIndex: 0,
      state: 'accepted',
      recommendationText: 'Accepted Q0 recommendation.',
      improvementText: 'Accepted Q0 improvement.',
    });

    const acceptedOverall = await agent
      .patch(`/interviews/${interviewId}/candidate-feedback`)
      .set(authCookie(session))
      .send({
        overall: {
          recommendationText: 'Accepted overall recommendation.',
          improvementText: 'Accepted overall improvement.',
          state: 'accepted',
        },
      })
      .expect(200);

    expect(acceptedOverall.body.overall).toMatchObject({
      state: 'accepted',
      recommendationText: 'Accepted overall recommendation.',
      improvementText: 'Accepted overall improvement.',
    });

    const generatedQ1 = await agent
      .post(
        `/interviews/${interviewId}/candidate-feedback/questions/1/generate`,
      )
      .set(authCookie(session))
      .send({})
      .expect(200);

    expect(generatedQ1.body).toEqual({
      questionIndex: 1,
      questionId: questionIds[1],
      recommendationText: 'Mock recommendation for Q1.',
      improvementText: 'Mock improvement for Q1.',
      state: 'generated',
    });
    expect(questionLlmSpy).toHaveBeenCalled();

    const editedQ1 = await agent
      .patch(`/interviews/${interviewId}/candidate-feedback`)
      .set(authCookie(session))
      .send({
        questions: [
          {
            questionIndex: 1,
            recommendationText: 'HR edited Q1 recommendation.',
            improvementText: 'HR edited Q1 improvement.',
            state: 'edited',
          },
        ],
      })
      .expect(200);

    expect(editedQ1.body.questions[1]).toMatchObject({
      questionIndex: 1,
      state: 'edited',
      recommendationText: 'HR edited Q1 recommendation.',
      improvementText: 'HR edited Q1 improvement.',
    });

    const generateAll = await agent
      .post(`/interviews/${interviewId}/candidate-feedback/generate`)
      .query({ scope: 'all' })
      .set(authCookie(session))
      .send({})
      .expect(200);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(generateAll.body).toEqual(
      expect.objectContaining({
        feedback: expect.objectContaining({
          interviewId,
          overall: expect.any(Object),
          questions: expect.any(Array),
          updatedAt: expect.any(String),
        }),
        questions: expect.any(Array),
        overall: expect.objectContaining({ status: 'skipped', reason: 'locked' }),
      }),
    );
    expect(generateAll.body.questions).toEqual(
      expect.arrayContaining([
        { status: 'skipped', questionIndex: 0, reason: 'locked' },
        { status: 'skipped', questionIndex: 1, reason: 'locked' },
      ]),
    );

    const feedback = generateAll.body.feedback;
    expect(
      feedback.questions.find(
        (question: { questionIndex: number }) => question.questionIndex === 0,
      ),
    ).toMatchObject({
      state: 'accepted',
      recommendationText: 'Accepted Q0 recommendation.',
      improvementText: 'Accepted Q0 improvement.',
    });
    expect(
      feedback.questions.find(
        (question: { questionIndex: number }) => question.questionIndex === 1,
      ),
    ).toMatchObject({
      state: 'edited',
      recommendationText: 'HR edited Q1 recommendation.',
      improvementText: 'HR edited Q1 improvement.',
    });
    expect(feedback.overall).toMatchObject({
      state: 'accepted',
      recommendationText: 'Accepted overall recommendation.',
      improvementText: 'Accepted overall improvement.',
    });

    expect(questionLlmSpy).toHaveBeenCalledTimes(1);
    expect(overallLlmSpy).not.toHaveBeenCalled();
  });

  it('starts generate-all in the background and completes via GET polling', async () => {
    const { app, agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);
    const questionIdA = await createQuestion(
      agent,
      session,
      'Async candidate feedback question A.',
    );
    const questionIdB = await createQuestion(
      agent,
      session,
      'Async candidate feedback question B.',
    );
    const { interviewId } = await createTwoQuestionCompletedInterview(
      app,
      agent,
      session,
      questionIdA,
      questionIdB,
    );

    let releaseFirstQuestion: (() => void) | undefined;
    const firstQuestionGate = new Promise<void>((resolve) => {
      releaseFirstQuestion = resolve;
    });
    questionLlmSpy.mockImplementationOnce(async () => {
      await firstQuestionGate;
      return {
        recommendationText: 'Mock recommendation for Q0.',
        improvementText: 'Mock improvement for Q0.',
      };
    });
    questionLlmSpy.mockResolvedValueOnce({
      recommendationText: 'Mock recommendation for Q1.',
      improvementText: 'Mock improvement for Q1.',
    });

    const started = await agent
      .post(`/interviews/${interviewId}/candidate-feedback/generate`)
      .query({ scope: 'all' })
      .set(authCookie(session))
      .send({})
      .expect(200);

    expect(started.body.questions).toEqual(
      expect.arrayContaining([
        { status: 'queued', questionIndex: 0 },
        { status: 'queued', questionIndex: 1 },
      ]),
    );
    expect(started.body.overall).toEqual({ status: 'queued' });

    releaseFirstQuestion?.();

    const deadline = Date.now() + 10_000;
    let finalFeedback = started.body.feedback;
    const isFullyGenerated = (feedback: {
      questions: Array<{ state: string }>;
      overall: { state: string };
    }) =>
      feedback.questions.every((question) => question.state === 'generated') &&
      feedback.overall.state === 'generated';

    while (Date.now() < deadline) {
      const polled = await agent
        .get(`/interviews/${interviewId}/candidate-feedback`)
        .set(authCookie(session))
        .expect(200);
      finalFeedback = polled.body;
      if (isFullyGenerated(finalFeedback)) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(isFullyGenerated(finalFeedback)).toBe(true);
    expect(finalFeedback.questions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          questionIndex: 0,
          state: 'generated',
          recommendationText: 'Mock recommendation for Q0.',
        }),
        expect.objectContaining({
          questionIndex: 1,
          state: 'generated',
          recommendationText: 'Mock recommendation for Q1.',
        }),
      ]),
    );
    expect(finalFeedback.overall).toMatchObject({
      state: 'generated',
      recommendationText: 'Mock overall recommendation.',
      improvementText: 'Mock overall improvement.',
    });
    expect(questionLlmSpy).toHaveBeenCalledTimes(2);
    expect(overallLlmSpy).toHaveBeenCalledTimes(1);
  });
});
