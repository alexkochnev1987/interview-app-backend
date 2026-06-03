import supertest = require('supertest');

import {
  getIntegrationApp,
  INTEGRATION_USERS,
  unauthenticatedRequest,
} from '../helpers/integration-app';
import {
  authCookie,
  loginAsHr,
  loginAsStaffAdmin,
  loginAsSuperAdmin,
} from '../helpers/integration-auth';
import { useIntegrationHarness } from '../helpers/integration-harness';

describe('Permissions (integration)', () => {
  let seedQuestionId = '';

  useIntegrationHarness({
    onFixtures: (fixtures) => {
      seedQuestionId = fixtures.seedQuestionId;
    },
  });

  it('rejects invalid login and unauthenticated /auth/me', async () => {
    const { app, agent } = await getIntegrationApp();

    await agent.get('/health').expect(200);

    await agent
      .post('/auth/login')
      .send({
        email: INTEGRATION_USERS.superAdmin.email,
        password: 'wrong-password',
      })
      .expect(401);

    await unauthenticatedRequest(app).get('/auth/me').expect(401);
  });

  it('logout clears staff session', async () => {
    const { app } = await getIntegrationApp();
    const agent = supertest.agent(app.getHttpServer());

    await agent
      .post('/auth/login')
      .send({
        email: INTEGRATION_USERS.superAdmin.email,
        password: INTEGRATION_USERS.superAdmin.password,
      })
      .expect(200);

    await agent.get('/auth/me').expect(200);

    const logout = await agent.post('/auth/logout').expect(200);
    expect(logout.body.ok).toBe(true);
    const setCookie = logout.headers['set-cookie'];
    const cookieHeader = Array.isArray(setCookie)
      ? setCookie.join(';')
      : (setCookie ?? '');
    expect(cookieHeader).toMatch(/session=;/);

    await agent.get('/auth/me').expect(401);
  });

  it('HR can read questions and create interviews but not create questions', async () => {
    const { agent } = await getIntegrationApp();
    const hrSession = await loginAsHr(agent);

    await agent
      .get('/questions')
      .set(authCookie(hrSession))
      .query({ page: 1, limit: 5, status: 'active' })
      .expect(200);

    await agent
      .post('/questions')
      .set(authCookie(hrSession))
      .send({
        questionText: 'HR should not create this.',
        difficulty: 'easy',
        weight: 1,
      })
      .expect(403);

    await agent
      .post('/interviews')
      .set(authCookie(hrSession))
      .send({
        candidateName: 'HR Created Interview',
        position: 'Analyst',
        questionIds: [seedQuestionId],
      })
      .expect(201);
  });

  it('admin can create and update questions but not delete them', async () => {
    const { agent } = await getIntegrationApp();
    const adminSession = await loginAsStaffAdmin(agent);

    const created = await agent
      .post('/questions')
      .set(authCookie(adminSession))
      .send({
        questionText: 'Admin-created question.',
        difficulty: 'hard',
        weight: 1,
      })
      .expect(201);

    await agent
      .patch(`/questions/${created.body.id}`)
      .set(authCookie(adminSession))
      .send({ questionText: 'Admin-updated question.' })
      .expect(200);

    await agent
      .delete(`/questions/${created.body.id}`)
      .set(authCookie(adminSession))
      .expect(403);
  });

  it('super_admin receives full permission set on /auth/me', async () => {
    const { agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);

    const me = await agent.get('/auth/me').set(authCookie(session)).expect(200);

    expect(me.body.role).toBe('super_admin');
    expect(me.body.permissions).toEqual(
      expect.arrayContaining([
        'questions:create',
        'questions:delete',
        'interviews:create',
        'users:assign_role',
      ]),
    );
  });

  it('HR /auth/me omits question mutation permissions', async () => {
    const { agent } = await getIntegrationApp();
    const session = await loginAsHr(agent);

    const me = await agent.get('/auth/me').set(authCookie(session)).expect(200);

    expect(me.body.role).toBe('hr');
    expect(me.body.permissions).toContain('questions:read');
    expect(me.body.permissions).not.toContain('questions:create');
    expect(me.body.permissions).not.toContain('questions:delete');
  });
});
