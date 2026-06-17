import supertest = require('supertest');

import {
  getIntegrationApp,
  INTEGRATION_USERS,
} from '../helpers/integration-app';
import {
  authCookie,
  loginAsHr,
  loginAsStaffAdmin,
  loginAsSuperAdmin,
} from '../helpers/integration-auth';
import { useIntegrationHarness } from '../helpers/integration-harness';
import {
  buildSubmitAnswerPayload,
  createTakeInterview,
  openCandidateTakeSession,
} from '../helpers/take-flow';
import { buildCreateQuestionPayload } from '../helpers/create-question-payload';

// Thin integration layer (~20% of backend tests): Nest + Postgres + cookies/guards.
// Business rules live in unit specs under src/.
describe('App wiring (integration)', () => {
  let seedQuestionId = '';

  useIntegrationHarness({
    onFixtures: (fixtures) => {
      seedQuestionId = fixtures.seedQuestionId;
    },
  });

  it('wires staff auth session and permission guards', async () => {
    const { app, agent } = await getIntegrationApp();

    await agent.get('/health').expect(200);

    await agent
      .post('/auth/login')
      .send({
        email: INTEGRATION_USERS.superAdmin.email,
        password: 'wrong-password',
      })
      .expect(401);

    const sessionAgent = supertest.agent(app.getHttpServer());
    await sessionAgent
      .post('/auth/login')
      .send({
        email: INTEGRATION_USERS.superAdmin.email,
        password: INTEGRATION_USERS.superAdmin.password,
      })
      .expect(200);

    await sessionAgent.get('/auth/me').expect(200);

    const logout = await sessionAgent.post('/auth/logout').expect(200);
    expect(logout.body.ok).toBe(true);
    await sessionAgent.get('/auth/me').expect(401);

    const hrSession = await loginAsHr(agent);
    await agent
      .post('/questions')
      .set(authCookie(hrSession))
      .send(
        buildCreateQuestionPayload('HR should not create this.', {
          difficulty: 'easy',
        }),
      )
      .expect(403);

    const adminSession = await loginAsStaffAdmin(agent);
    const created = await agent
      .post('/questions')
      .set(authCookie(adminSession))
      .send(
        buildCreateQuestionPayload('Admin-created question.', {
          difficulty: 'hard',
        }),
      )
      .expect(201);

    await agent
      .delete(`/questions/${created.body.id}`)
      .set(authCookie(adminSession))
      .expect(403);
  });

  it('wires ValidationPipe on recruiter write routes', async () => {
    const { agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);

    await agent
      .post('/questions')
      .set(authCookie(session))
      .send({})
      .expect(400);
  });

  it('wires recruiter APIs through Postgres', async () => {
    const { agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);

    const created = await agent
      .post('/questions')
      .set(authCookie(session))
      .send(buildCreateQuestionPayload('Integration wiring question.'))
      .expect(201);

    const interview = await agent
      .post('/interviews')
      .set(authCookie(session))
      .send({
        candidateName: 'Wiring Candidate',
        position: 'Engineer',
        questionIds: [created.body.id],
      })
      .expect(201);

    expect(interview.body.candidateLink).toContain('/take/');

    await agent
      .get(`/interviews/${interview.body.id}`)
      .set(authCookie(session))
      .expect(200);
  });

  it('wires HR interview ownership checks with Postgres', async () => {
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

  it('wires candidate take flow with session cookie', async () => {
    const { agent } = await getIntegrationApp();
    const staffSession = await loginAsSuperAdmin(agent);
    const { interviewId, token } = await createTakeInterview(
      agent,
      staffSession,
      seedQuestionId,
    );

    const take = await openCandidateTakeSession(agent, interviewId, token);
    expect(take.body.completed).toBe(false);

    const submitted = await agent
      .post(`/take/${interviewId}/answer`)
      .send(buildSubmitAnswerPayload(interviewId, 0, 1))
      .expect(201);

    expect(submitted.body.completed).toBe(true);

    const takeAfterSubmit = await agent.get(`/take/${interviewId}`).expect(200);
    expect(takeAfterSubmit.body.completed).toBe(true);

    const completed = await agent
      .patch(`/interviews/${interviewId}/complete`)
      .set(authCookie(staffSession))
      .expect(200);

    expect(completed.body.answers).toHaveLength(1);
    expect(completed.body.answers[0].status).toBe('submitted');
  });
});
