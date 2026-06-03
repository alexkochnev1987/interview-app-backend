import supertest = require('supertest');

import {
  getIntegrationApp,
  unauthenticatedRequest,
} from '../helpers/integration-app';
import {
  authCookie,
  loginAsHr,
  loginAsSuperAdmin,
} from '../helpers/integration-auth';
import { useIntegrationHarness } from '../helpers/integration-harness';
import { createTakeInterview } from '../helpers/take-flow';

describe('API contract negatives (integration)', () => {
  let seedQuestionId = '';

  useIntegrationHarness({
    onFixtures: (fixtures) => {
      seedQuestionId = fixtures.seedQuestionId;
    },
  });

  it('returns 400 for invalid staff DTOs', async () => {
    const { agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);

    await agent
      .post('/questions')
      .set(authCookie(session))
      .send({
        difficulty: 'medium',
        weight: 1,
      })
      .expect(400);

    await agent
      .post('/interviews')
      .set(authCookie(session))
      .send({
        candidateName: 'Contract Test Candidate',
        position: 'Engineer',
        questionIds: [],
      })
      .expect(400);
  });

  it('returns 401 for invalid candidate take tokens', async () => {
    const { app, agent } = await getIntegrationApp();
    const staffSession = await loginAsSuperAdmin(agent);
    const { interviewId } = await createTakeInterview(
      agent,
      staffSession,
      seedQuestionId,
    );

    await unauthenticatedRequest(app)
      .get(`/take/${interviewId}`)
      .query({ token: 'not-a-valid-token' })
      .expect(401);
  });

  it('returns 403 when HR reads another users interview (IDOR)', async () => {
    const { app, agent } = await getIntegrationApp();
    const adminSession = await loginAsSuperAdmin(agent);

    const interview = await agent
      .post('/interviews')
      .set(authCookie(adminSession))
      .send({
        candidateName: 'IDOR Candidate',
        position: 'Security Engineer',
        questionIds: [seedQuestionId],
      })
      .expect(201);

    const hrAgent = supertest.agent(app.getHttpServer());
    const hrSession = await loginAsHr(hrAgent);

    await hrAgent
      .get(`/interviews/${interview.body.id}`)
      .set(authCookie(hrSession))
      .expect(403);
  });
});
