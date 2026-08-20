import { INestApplication } from '@nestjs/common';
import supertest from 'supertest';

import { DatabaseService } from '../../src/database/database.service';
import { InterviewService } from '../../src/interview/interview.service';
import {
  getIntegrationApp,
  parseCandidateToken,
  type IntegrationAgent,
} from '../helpers/integration-app';
import {
  authCookie,
  loginAsSuperAdmin,
  registerAsCandidate,
} from '../helpers/integration-auth';
import { setInterviewDemo } from '../helpers/integration-db';
import { useIntegrationHarness } from '../helpers/integration-harness';
import {
  buildSubmitAnswerPayload,
  openCandidateTakeSession,
  reserveCandidateAnswerAttempt,
} from '../helpers/take-flow';

async function createInterviewForCandidate(
  agent: IntegrationAgent,
  staffSession: string,
  questionId: string,
  overrides: { candidateEmail: string; position?: string },
): Promise<string> {
  const response = await agent
    .post('/interviews')
    .set(authCookie(staffSession))
    .send({
      candidateName: 'Portal Candidate',
      candidateEmail: overrides.candidateEmail,
      position: overrides.position ?? 'Engineer',
      questionIds: [questionId],
    })
    .expect(201);

  return response.body.id as string;
}

// Completes an interview end-to-end (take flow + AI validation) so it
// reaches `completed`, matching how candidate-feedback-share.integration.spec.ts
// sets up its own "ready" fixture.
async function completeInterview(
  app: INestApplication,
  agent: IntegrationAgent,
  staffSession: string,
  interviewId: string,
): Promise<void> {
  const linkRes = await agent
    .post(`/interviews/${interviewId}/candidate-link`)
    .set(authCookie(staffSession))
    .expect(201);
  const token = parseCandidateToken(linkRes.body.candidateLink);

  await openCandidateTakeSession(agent, interviewId, token);
  const reserved = await reserveCandidateAnswerAttempt(agent, interviewId, 0);
  await agent
    .post(`/take/${interviewId}/answer`)
    .send(buildSubmitAnswerPayload(interviewId, 0, reserved.versionNumber))
    .expect(201);

  const interviewService = app.get(InterviewService);
  const completedAt = new Date();
  const runId = `integration-portal-${interviewId}`;
  await interviewService.queueAnswerValidation(interviewId, {
    questionIndex: 0,
    sourceVersionNumber: 1,
    runId,
    requestedAt: completedAt,
  });
  await interviewService.completeAnswerValidation(interviewId, {
    questionIndex: 0,
    sourceVersionNumber: 1,
    runId,
    requestedAt: completedAt,
    completedAt,
    transcript: { text: 'Portal integration transcript.', isFinal: true },
    evaluation: {
      overallScore: 85,
      summary: 'Solid answer.',
      evaluatedAt: completedAt,
    },
  });
}

describe('Candidate portal interviews API (integration)', () => {
  let seedQuestionId = '';

  useIntegrationHarness({
    onFixtures: (fixtures) => {
      seedQuestionId = fixtures.seedQuestionId;
    },
  });

  it("lists only the candidate's own non-demo interviews, most relevant first", async () => {
    const { app, agent } = await getIntegrationApp();
    const staffSession = await loginAsSuperAdmin(agent);
    const databaseService = app.get(DatabaseService);
    const candidateEmail = `portal-${Date.now()}@test.local`;

    const ownPendingId = await createInterviewForCandidate(
      agent,
      staffSession,
      seedQuestionId,
      { candidateEmail, position: 'Own Pending Role' },
    );
    const ownDemoId = await createInterviewForCandidate(
      agent,
      staffSession,
      seedQuestionId,
      { candidateEmail, position: 'Own Demo Role' },
    );
    await setInterviewDemo(databaseService, ownDemoId, true);
    await createInterviewForCandidate(agent, staffSession, seedQuestionId, {
      candidateEmail: `other-${Date.now()}@test.local`,
      position: 'Someone Elses Role',
    });

    // Separate agent so the candidate's session cookie never mixes with the
    // staff agent's cookie jar (mirrors the hrAgent pattern in
    // interview-list.integration.spec.ts).
    const candidateAgent = supertest.agent(app.getHttpServer());
    const candidateSession = await registerAsCandidate(candidateAgent, {
      email: candidateEmail,
    });

    const response = await candidateAgent
      .get('/portal/interviews')
      .set(authCookie(candidateSession))
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      id: ownPendingId,
      position: 'Own Pending Role',
      status: 'pending',
      resultsReady: false,
      questionCount: 1,
      maxAnswerAttempts: expect.any(Number),
    });
    expect(response.body[0].continueUrl).toMatch(
      new RegExp(`^/take/${ownPendingId}\\?token=`),
    );

    // Single-item fetch (interview-detail page) has the same shape/scoping.
    const single = await candidateAgent
      .get(`/portal/interviews/${ownPendingId}`)
      .set(authCookie(candidateSession))
      .expect(200);
    expect(single.body).toMatchObject({
      id: ownPendingId,
      position: 'Own Pending Role',
      status: 'pending',
      questionCount: 1,
      maxAnswerAttempts: expect.any(Number),
    });

    const otherCandidateAgent = supertest.agent(app.getHttpServer());
    const otherCandidateSession = await registerAsCandidate(
      otherCandidateAgent,
      {
        email: `portal-list-other-${Date.now()}@test.local`,
      },
    );
    await otherCandidateAgent
      .get(`/portal/interviews/${ownPendingId}`)
      .set(authCookie(otherCandidateSession))
      .expect(403);
  });

  it('exposes results only once HR publishes feedback, and denies a non-owning candidate', async () => {
    const { app, agent } = await getIntegrationApp();
    const staffSession = await loginAsSuperAdmin(agent);
    const candidateEmail = `portal-results-${Date.now()}@test.local`;

    const interviewId = await createInterviewForCandidate(
      agent,
      staffSession,
      seedQuestionId,
      { candidateEmail, position: 'Results Role' },
    );
    await completeInterview(app, agent, staffSession, interviewId);

    // Separate agents per identity — see the comment in the previous test.
    const candidateAgent = supertest.agent(app.getHttpServer());
    const candidateSession = await registerAsCandidate(candidateAgent, {
      email: candidateEmail,
    });

    // Not published yet: list shows resultsReady=false, no continueUrl
    // (terminal), and the results endpoint 404s.
    const beforePublish = await candidateAgent
      .get('/portal/interviews')
      .set(authCookie(candidateSession))
      .expect(200);
    expect(beforePublish.body[0]).toMatchObject({
      id: interviewId,
      status: 'completed',
      resultsReady: false,
    });
    expect(beforePublish.body[0].continueUrl).toBeUndefined();

    await candidateAgent
      .get(`/portal/interviews/${interviewId}/results`)
      .set(authCookie(candidateSession))
      .expect(404);

    // HR publishes one accepted block.
    await agent
      .patch(`/interviews/${interviewId}/candidate-feedback`)
      .set(authCookie(staffSession))
      .send({
        questions: [
          {
            questionIndex: 0,
            recommendationText: 'Great structured answer.',
            improvementText: 'Could go deeper on trade-offs.',
            state: 'accepted',
          },
        ],
        outcome: 'next_stage',
      })
      .expect(200);

    const afterPublish = await candidateAgent
      .get('/portal/interviews')
      .set(authCookie(candidateSession))
      .expect(200);
    expect(afterPublish.body[0]).toMatchObject({
      id: interviewId,
      resultsReady: true,
    });

    const results = await candidateAgent
      .get(`/portal/interviews/${interviewId}/results`)
      .set(authCookie(candidateSession))
      .expect(200);
    expect(results.body).toMatchObject({
      position: 'Results Role',
      outcome: 'next_stage',
      questions: [
        {
          questionIndex: 0,
          recommendationText: 'Great structured answer.',
          improvementText: 'Could go deeper on trade-offs.',
        },
      ],
    });
    expect(results.body).not.toHaveProperty('expiresAt');

    // A different candidate cannot read these results.
    const otherCandidateAgent = supertest.agent(app.getHttpServer());
    const otherCandidateSession = await registerAsCandidate(
      otherCandidateAgent,
      {
        email: `portal-other-${Date.now()}@test.local`,
      },
    );
    await otherCandidateAgent
      .get(`/portal/interviews/${interviewId}/results`)
      .set(authCookie(otherCandidateSession))
      .expect(403);
  });

  it('denies a staff actor from using the candidate-portal list', async () => {
    const { agent } = await getIntegrationApp();
    const staffSession = await loginAsSuperAdmin(agent);

    await agent
      .get('/portal/interviews')
      .set(authCookie(staffSession))
      .expect(403);
  });
});
