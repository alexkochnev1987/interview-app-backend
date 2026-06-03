import { JwtService } from '@nestjs/jwt';

import {
  closeIntegrationApp,
  getIntegrationApp,
  unauthenticatedRequest,
} from '../helpers/integration-app';
import {  loginAsSuperAdmin } from '../helpers/integration-auth';
import {
  buildAnswerProgressPayload,
  buildSubmitAnswerPayload,
  createTakeInterview,
  openCandidateTakeSession,
} from '../helpers/take-flow';

describe('Take flow (integration)', () => {
  let seedQuestionId = '';

  beforeAll(async () => {
    const { fixtures } = await getIntegrationApp();
    seedQuestionId = fixtures.seedQuestionId;
  });

  afterAll(async () => {
    await closeIntegrationApp();
  });

  it('covers candidate progress, submit, and validation guards on happy path', async () => {
    const { agent } = await getIntegrationApp();
    const staffSession = await loginAsSuperAdmin(agent);
    const { interviewId, token } = await createTakeInterview(
      agent,
      staffSession,
      seedQuestionId,
    );

    const take = await openCandidateTakeSession(agent, interviewId, token);
    expect(take.body.completed).toBe(false);
    expect(take.body.totalQuestions).toBe(1);
    expect(take.body.currentQuestionIndex).toBe(0);

    const progress = await agent
      .post(`/take/${interviewId}/answer/progress`)
      .send(buildAnswerProgressPayload(interviewId, 0, 1))
      .expect(201);

    expect(progress.body.ok).toBe(true);
    expect(progress.body.status).toBe('recording');
    expect(progress.body.versionCount).toBeGreaterThanOrEqual(1);

    const submitted = await agent
      .post(`/take/${interviewId}/answer`)
      .send(buildSubmitAnswerPayload(interviewId, 0, 1))
      .expect(201);

    expect(submitted.body.ok).toBe(true);
    expect(submitted.body.answeredCount).toBe(1);
    expect(submitted.body.completed).toBe(true);

    const completed = await agent.get(`/take/${interviewId}`).expect(200);
    expect(completed.body.completed).toBe(true);
    expect(completed.body.currentQuestion).toBeNull();

    await agent
      .post(`/take/${interviewId}/questions/0/validate`)
      .expect(503);
  });

  it('validate rejects answers that are not submitted yet', async () => {
    const previousProvider = process.env.AI_PROVIDER;
    const previousKey = process.env.OPENAI_API_KEY;
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'integration-test-key';

    try {
      const { agent } = await getIntegrationApp();
      const staffSession = await loginAsSuperAdmin(agent);
      const { interviewId, token } = await createTakeInterview(
        agent,
        staffSession,
        seedQuestionId,
      );

      await openCandidateTakeSession(agent, interviewId, token);

      await agent
        .post(`/take/${interviewId}/answer/progress`)
        .send(buildAnswerProgressPayload(interviewId, 0, 1))
        .expect(201);

      await agent
        .post(`/take/${interviewId}/questions/0/validate`)
        .expect(400);
    } finally {
      if (previousProvider) {
        process.env.AI_PROVIDER = previousProvider;
      } else {
        delete process.env.AI_PROVIDER;
      }
      if (previousKey) {
        process.env.OPENAI_API_KEY = previousKey;
      } else {
        delete process.env.OPENAI_API_KEY;
      }
    }
  });

  it('rejects missing, invalid, expired, and mismatched candidate tokens', async () => {
    const { app, agent } = await getIntegrationApp();
    const staffSession = await loginAsSuperAdmin(agent);
    const first = await createTakeInterview(agent, staffSession, seedQuestionId);
    const second = await createTakeInterview(agent, staffSession, seedQuestionId);

    await unauthenticatedRequest(app)
      .get(`/take/${first.interviewId}`)
      .expect(401);

    await unauthenticatedRequest(app)
      .get(`/take/${first.interviewId}`)
      .query({ token: 'not-a-valid-token' })
      .expect(401);

    const jwtService = app.get(JwtService);
    const expiredToken = jwtService.sign(
      { interviewId: first.interviewId, role: 'candidate' },
      { expiresIn: 0 },
    );

    await unauthenticatedRequest(app)
      .get(`/take/${first.interviewId}`)
      .query({ token: expiredToken })
      .expect(401);

    await unauthenticatedRequest(app)
      .get(`/take/${second.interviewId}`)
      .query({ token: first.token })
      .expect(400);

    await openCandidateTakeSession(agent, first.interviewId, first.token);

    await agent
      .post(`/take/${second.interviewId}/answer/progress`)
      .send(buildAnswerProgressPayload(second.interviewId, 0, 1))
      .expect(400);
  });

  it('requires a candidate session cookie for take mutations', async () => {
    const { app, agent } = await getIntegrationApp();
    const staffSession = await loginAsSuperAdmin(agent);
    const { interviewId } = await createTakeInterview(
      agent,
      staffSession,
      seedQuestionId,
    );

    const guest = unauthenticatedRequest(app);

    await guest
      .post(`/take/${interviewId}/answer/progress`)
      .send(buildAnswerProgressPayload(interviewId, 0, 1))
      .expect(401);

    await guest
      .post(`/take/${interviewId}/answer`)
      .send(buildSubmitAnswerPayload(interviewId, 0, 1))
      .expect(401);

    await guest
      .post(`/take/${interviewId}/questions/0/validate`)
      .expect(401);
  });
});
