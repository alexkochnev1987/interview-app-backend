import { INestApplication } from '@nestjs/common';

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

async function createCompletedInterview(
  app: INestApplication,
  agent: IntegrationAgent,
  session: string,
  questionIds: string[],
): Promise<{ interviewId: string }> {
  const interviewRes = await agent
    .post('/interviews')
    .set(authCookie(session))
    .send({
      candidateName: 'CF Share Candidate',
      candidateEmail: `cf-share-${Date.now()}@test.local`,
      position: 'Integration CF Share Role',
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
    await agent
      .post(`/take/${interviewId}/answer`)
      .send(buildSubmitAnswerPayload(interviewId, questionIndex, 1))
      .expect(201);
  }

  const interviewService = app.get(InterviewService);
  const completedAt = new Date();

  for (const questionIndex of questionIds.map((_, index) => index)) {
    const runId = `integration-cf-share-q${questionIndex}`;
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
        text: `Integration share transcript for question ${questionIndex}.`,
        isFinal: true,
      },
      evaluation: {
        overallScore: 80 + questionIndex,
        summary: `Summary for question ${questionIndex}.`,
        evaluatedAt: completedAt,
      },
    });
  }

  return { interviewId };
}

async function syncCandidateFeedback(
  agent: IntegrationAgent,
  session: string,
  interviewId: string,
): Promise<void> {
  await agent
    .get(`/interviews/${interviewId}/candidate-feedback`)
    .set(authCookie(session))
    .expect(200);
}

function extractShareToken(url: string): string {
  const token = url.split('/').pop();
  if (!token) {
    throw new Error(`Share URL has no token: ${url}`);
  }
  return token;
}

describe('Candidate feedback share links (integration)', () => {
  useIntegrationHarness();

  it('blocks create when there is no publishable candidate feedback', async () => {
    const { app, agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);
    const questionId = await createQuestion(
      agent,
      session,
      'Share gate question.',
    );
    const { interviewId } = await createCompletedInterview(app, agent, session, [
      questionId,
    ]);
    await syncCandidateFeedback(agent, session, interviewId);

    const blocked = await agent
      .post(`/interviews/${interviewId}/candidate-feedback/share-link`)
      .set(authCookie(session))
      .send({})
      .expect(409);

    expect(blocked.body.message).toMatch(/publishable/i);
  });

  it('creates a share link, returns filtered public payload, and revokes on recreate', async () => {
    const { app, agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);
    const questionId = await createQuestion(
      agent,
      session,
      'Publishable question.',
    );
    const { interviewId } = await createCompletedInterview(app, agent, session, [
      questionId,
    ]);
    await syncCandidateFeedback(agent, session, interviewId);

    await agent
      .patch(`/interviews/${interviewId}/candidate-feedback`)
      .set(authCookie(session))
      .send({
        questions: [
          {
            questionIndex: 0,
            recommendationText: 'Published Q0 strengths.',
            improvementText: 'Published Q0 growth.',
            state: 'accepted',
          },
        ],
      })
      .expect(200);

    const created = await agent
      .post(`/interviews/${interviewId}/candidate-feedback/share-link`)
      .set(authCookie(session))
      .send({})
      .expect(201);

    expect(created.body.url).toMatch(
      /^http:\/\/localhost:3001\/feedback\/share\/[^/]+$/,
    );
    expect(created.body.expiresAt).toBeDefined();

    const firstToken = extractShareToken(created.body.url as string);

    const publicPayload = await agent
      .get(`/feedback/share/${firstToken}`)
      .expect(200);

    expect(publicPayload.body).toMatchObject({
      position: 'Integration CF Share Role',
      questions: [
        {
          questionIndex: 0,
          recommendationText: 'Published Q0 strengths.',
          improvementText: 'Published Q0 growth.',
        },
      ],
    });
    expect(publicPayload.body.questions[0].state).toBeUndefined();

    const recreated = await agent
      .post(`/interviews/${interviewId}/candidate-feedback/share-link`)
      .set(authCookie(session))
      .send({})
      .expect(201);

    const secondToken = extractShareToken(recreated.body.url as string);
    expect(secondToken).not.toBe(firstToken);

    await agent.get(`/feedback/share/${firstToken}`).expect(404);
    await agent.get(`/feedback/share/${secondToken}`).expect(200);
  });
});
