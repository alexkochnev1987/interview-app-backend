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
  reserveCandidateAnswerAttempt,
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

async function createCompletedInterview(
  app: INestApplication,
  agent: IntegrationAgent,
  session: string,
  questionIds: string[],
  options?: {
    evaluations?: Parameters<
      InterviewService['completeAnswerValidation']
    >[1]['evaluation'][];
    transcripts?: string[];
  },
): Promise<{ interviewId: string }> {
  const interviewRes = await agent
    .post('/interviews')
    .set(authCookie(session))
    .send({
      candidateName: 'Candidate Feedback Candidate',
      candidateEmail: `cf-${Date.now()}@test.local`,
      position: 'Integration CF Role',
      questionIds,
    })
    .expect(201);

  const interviewId = interviewRes.body.id as string;
  const linkRes = await agent
    .post(`/interviews/${interviewId}/candidate-link`)
    .set(authCookie(session))
    .expect(201);
  const token = parseCandidateToken(linkRes.body.candidateLink);

  await openCandidateTakeSession(agent, interviewId, token);
  for (const questionIndex of questionIds.map((_, index) => index)) {
    const reserved = await reserveCandidateAnswerAttempt(
      agent,
      interviewId,
      questionIndex,
    );
    await agent
      .post(`/take/${interviewId}/answer`)
      .send(
        buildSubmitAnswerPayload(
          interviewId,
          questionIndex,
          reserved.versionNumber,
        ),
      )
      .expect(201);
  }

  const interviewService = app.get(InterviewService);
  const completedAt = new Date();

  for (const questionIndex of questionIds.map((_, index) => index)) {
    const runId = `integration-candidate-feedback-q${questionIndex}`;
    await interviewService.queueAnswerValidation(interviewId, {
      questionIndex,
      sourceVersionNumber: 1,
      runId,
      requestedAt: completedAt,
    });
    await interviewService.completeAnswerValidation(interviewId, {
      questionIndex,
      sourceVersionNumber: 1,
      runId,
      requestedAt: completedAt,
      completedAt,
      transcript: {
        text:
          options?.transcripts?.[questionIndex] ??
          `Integration transcript for question ${questionIndex}.`,
        isFinal: true,
      },
      evaluation:
        options?.evaluations?.[questionIndex] ??
        ({
          overallScore: 80 + questionIndex,
          summary: `Summary for question ${questionIndex}.`,
          evaluatedAt: completedAt,
        } satisfies Parameters<
          InterviewService['completeAnswerValidation']
        >[1]['evaluation']),
    });
  }

  return { interviewId };
}

async function waitForFeedback(
  agent: IntegrationAgent,
  session: string,
  interviewId: string,
  predicate: (body: {
    questions: Array<{ state: string }>;
    overall: { state: string };
  }) => boolean,
): Promise<unknown> {
  const deadline = Date.now() + 10_000;
  let latest = null;
  while (Date.now() < deadline) {
    const polled = await agent
      .get(`/interviews/${interviewId}/candidate-feedback`)
      .set(authCookie(session))
      .expect(200);
    latest = polled.body;
    if (predicate(polled.body)) {
      return polled.body;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return latest;
}

describe('Candidate feedback (integration)', () => {
  useIntegrationHarness();

  let questionLlmSpy: ReturnType<typeof vi.spyOn>;
  let overallLlmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'integration-test-openai-key';
    questionLlmSpy = vi
      .spyOn(
        candidateFeedbackLlm,
        'generateCandidateFeedbackQuestionWithNativeLlm',
      )
      .mockResolvedValue({
        recommendationText: 'Mock recommendation.',
        improvementText: 'Mock improvement.',
      });
    overallLlmSpy = vi
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

  it('prefills skip templates for garbage transcripts and keeps per-question skip reasons', async () => {
    const { app, agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);
    const questionIds = await Promise.all([
      createQuestion(agent, session, 'Good answer question.'),
      createQuestion(agent, session, 'Garbage outro question.'),
    ]);
    const { interviewId } = await createCompletedInterview(
      app,
      agent,
      session,
      questionIds,
      {
        transcripts: [
          'I described indexing, query plans, and cache invalidation clearly.',
          'Thanks for watching! Like and subscribe for more videos.',
        ],
      },
    );

    const started = await agent
      .post(`/interviews/${interviewId}/candidate-feedback/generate`)
      .query({ scope: 'all' })
      .set(authCookie(session))
      .send({})
      .expect(200);

    expect(started.body.questions).toEqual(
      expect.arrayContaining([
        { status: 'queued', questionIndex: 0 },
        { status: 'skipped', questionIndex: 1, reason: 'unusable_transcript' },
      ]),
    );
    expect(started.body.feedback.questions[1]).toMatchObject({
      state: 'edited',
      recommendationText:
        'The recorded response did not contain a substantive answer to this question.',
      errorMessage: 'unusable_transcript',
    });

    await waitForFeedback(
      agent,
      session,
      interviewId,
      (body) =>
        body.questions[0]?.state === 'generated'
        && body.questions[1]?.state === 'edited',
    );
    expect(questionLlmSpy).toHaveBeenCalledTimes(1);
  });

  it('uses non-balanced overall tone for mixed interviews', async () => {
    const { app, agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);
    const completedAt = new Date();
    const questionIds = await Promise.all([
      createQuestion(agent, session, 'CF-MIXED good question.'),
      createQuestion(agent, session, 'CF-MIXED garbage question.'),
      createQuestion(agent, session, 'CF-MIXED off-topic question.'),
    ]);
    const { interviewId } = await createCompletedInterview(
      app,
      agent,
      session,
      questionIds,
      {
        transcripts: [
          'After a deploy latency jumped; I added Redis caching and restored SLOs.',
          'İzlediğiniz için teşekkür ederim. Bir sonraki videoda görüşürüz.',
          'I track personal finance and went to Portugal last summer.',
        ],
        evaluations: [
          {
            overallScore: 90,
            decisionHint: 'pass',
            summary: 'Strong answer.',
            categoryScores: { relevance: 92 },
            evaluatedAt: completedAt,
          },
          {
            overallScore: 10,
            decisionHint: 'fail',
            summary: 'Did not address the question.',
            evaluatedAt: completedAt,
          },
          {
            overallScore: 18,
            decisionHint: 'fail',
            summary: 'Off-topic response.',
            categoryScores: { relevance: 12 },
            evaluatedAt: completedAt,
          },
        ],
      },
    );

    await agent
      .post(`/interviews/${interviewId}/candidate-feedback/generate`)
      .query({ scope: 'all' })
      .set(authCookie(session))
      .send({})
      .expect(200);

    await waitForFeedback(
      agent,
      session,
      interviewId,
      (body) =>
        body.overall.state === 'generated' &&
        body.questions.every(
          (question) => question.state === 'generated' || question.state === 'edited',
        ),
    );

    expect(overallLlmSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        toneMode: 'honest_weak',
        mixMetadata: {
          answeredWellCount: 1,
          noSubstantiveAnswerCount: 1,
          weakAnswerCount: 1,
          totalQuestions: 3,
        },
      }),
    );
  });

  it('does not overwrite accepted or edited blocks on generate-all', async () => {
    const { app, agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);
    const questionIds = await Promise.all([
      createQuestion(agent, session, 'Locked question A.'),
      createQuestion(agent, session, 'Locked question B.'),
    ]);
    const { interviewId } = await createCompletedInterview(
      app,
      agent,
      session,
      questionIds,
    );

    await agent
      .patch(`/interviews/${interviewId}/candidate-feedback`)
      .set(authCookie(session))
      .send({
        questions: [
          {
            questionIndex: 0,
            recommendationText: 'Accepted Q0.',
            improvementText: 'Accepted Q0 improvement.',
            state: 'accepted',
          },
          {
            questionIndex: 1,
            recommendationText: 'Edited Q1.',
            improvementText: 'Edited Q1 improvement.',
            state: 'edited',
          },
        ],
        overall: {
          recommendationText: 'Accepted overall.',
          improvementText: 'Accepted overall improvement.',
          state: 'accepted',
        },
      })
      .expect(200);

    const generateAll = await agent
      .post(`/interviews/${interviewId}/candidate-feedback/generate`)
      .query({ scope: 'all' })
      .set(authCookie(session))
      .send({})
      .expect(200);

    expect(generateAll.body.questions).toEqual(
      expect.arrayContaining([
        { status: 'skipped', questionIndex: 0, reason: 'locked' },
        { status: 'skipped', questionIndex: 1, reason: 'locked' },
      ]),
    );
    expect(generateAll.body.feedback.questions[0]).toMatchObject({
      state: 'accepted',
      recommendationText: 'Accepted Q0.',
    });
    expect(generateAll.body.feedback.questions[1]).toMatchObject({
      state: 'edited',
      recommendationText: 'Edited Q1.',
    });
    expect(questionLlmSpy).not.toHaveBeenCalled();
    expect(overallLlmSpy).not.toHaveBeenCalled();
  });
});
