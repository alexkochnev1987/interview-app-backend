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

function extractShareToken(url: string): string {
  const token = url.split('/').pop();
  if (!token) {
    throw new Error(`Share URL has no token: ${url}`);
  }
  return token;
}

describe('Candidate feedback share links (integration)', () => {
  useIntegrationHarness();

  it('creates a share link, returns public payload, and supports revoke', async () => {
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

    await agent
      .get(`/interviews/${interviewId}/candidate-feedback`)
      .set(authCookie(session))
      .expect(200);

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
        outcome: 'next_stage',
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

    const token = extractShareToken(created.body.url as string);
    const publicPayload = await agent.get(`/feedback/share/${token}`).expect(200);

    expect(publicPayload.body).toMatchObject({
      position: 'Integration CF Share Role',
      outcome: 'next_stage',
      questions: [
        {
          questionIndex: 0,
          recommendationText: 'Published Q0 strengths.',
          improvementText: 'Published Q0 growth.',
        },
      ],
    });

    const revoked = await agent
      .delete(`/interviews/${interviewId}/candidate-feedback/share-link`)
      .set(authCookie(session))
      .expect(200);

    expect(revoked.body).toEqual({ revoked: true });
    await agent.get(`/feedback/share/${token}`).expect(404);
  });
});
