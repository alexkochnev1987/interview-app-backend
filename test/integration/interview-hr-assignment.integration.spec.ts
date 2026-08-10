import supertest from 'supertest';

import { DatabaseService } from '../../src/database/database.service';
import type { InterviewStatus } from '../../src/interview/interfaces/interview.interface';
import {
  getIntegrationApp,
  type IntegrationAgent,
} from '../helpers/integration-app';
import {
  authCookie,
  loginAsHr,
  loginAsSuperAdmin,
} from '../helpers/integration-auth';
import { updateInterviewStatus } from '../helpers/integration-db';
import { useIntegrationHarness } from '../helpers/integration-harness';

function createInterview(
  agent: IntegrationAgent,
  session: string,
  questionId: string,
  overrides: {
    candidateName?: string;
    position?: string;
    assignedHrId?: string;
  } = {},
) {
  return agent
    .post('/interviews')
    .set(authCookie(session))
    .send({
      candidateName: overrides.candidateName ?? 'Assignment Test Candidate',
      position: overrides.position ?? 'Engineer',
      questionIds: [questionId],
      ...(overrides.assignedHrId
        ? { assignedHrId: overrides.assignedHrId }
        : {}),
    });
}

describe('Interview HR assignment (integration)', () => {
  let seedQuestionId = '';
  let hrUserId = '';
  let superAdminUserId = '';

  useIntegrationHarness({
    onFixtures: (fixtures) => {
      seedQuestionId = fixtures.seedQuestionId;
      hrUserId = fixtures.hr.id;
      superAdminUserId = fixtures.superAdmin.id;
    },
  });

  it('allows admin to create interview with assigned HR', async () => {
    const { agent } = await getIntegrationApp();
    const adminSession = await loginAsSuperAdmin(agent);

    const response = await createInterview(
      agent,
      adminSession,
      seedQuestionId,
      {
        candidateName: 'Assigned Create Test',
        assignedHrId: hrUserId,
      },
    ).expect(201);

    expect(response.body.assignedHrId).toBe(hrUserId);
    expect(response.body.assignedHr).toMatchObject({
      id: hrUserId,
      name: 'Integration HR',
      email: 'hr@test.local',
    });
  });

  it('forbids HR from setting assignedHrId on create', async () => {
    const { agent } = await getIntegrationApp();
    const hrSession = await loginAsHr(agent);

    await createInterview(agent, hrSession, seedQuestionId, {
      assignedHrId: hrUserId,
    }).expect(403);
  });

  it('allows assigned HR to read interview they did not create', async () => {
    const { app, agent } = await getIntegrationApp();
    const adminSession = await loginAsSuperAdmin(agent);

    const created = await createInterview(
      agent,
      adminSession,
      seedQuestionId,
      {
        candidateName: 'Assigned Read Test',
        assignedHrId: hrUserId,
      },
    ).expect(201);

    const hrAgent = supertest.agent(app.getHttpServer());
    const hrSession = await loginAsHr(hrAgent);

    const response = await hrAgent
      .get(`/interviews/${created.body.id}`)
      .set(authCookie(hrSession))
      .expect(200);

    expect(response.body.candidateName).toBe('Assigned Read Test');
    expect(response.body.assignedHrId).toBe(hrUserId);
  });

  it('includes assigned interviews in HR list scope', async () => {
    const { app, agent } = await getIntegrationApp();
    const adminSession = await loginAsSuperAdmin(agent);

    await createInterview(agent, adminSession, seedQuestionId, {
      candidateName: 'Assigned List Test',
      assignedHrId: hrUserId,
    }).expect(201);

    const hrAgent = supertest.agent(app.getHttpServer());
    const hrSession = await loginAsHr(hrAgent);

    const hrList = await hrAgent
      .get('/interviews')
      .set(authCookie(hrSession))
      .expect(200);

    expect(hrList.body.total).toBe(1);
    expect(hrList.body.items[0].candidateName).toBe('Assigned List Test');
  });

  it('allows admin to clear assignment on update', async () => {
    const { agent } = await getIntegrationApp();
    const adminSession = await loginAsSuperAdmin(agent);

    const created = await createInterview(
      agent,
      adminSession,
      seedQuestionId,
      { assignedHrId: hrUserId },
    ).expect(201);

    const response = await agent
      .patch(`/interviews/${created.body.id}`)
      .set(authCookie(adminSession))
      .send({ assignedHrId: null })
      .expect(200);

    expect(response.body.assignedHrId).toBeUndefined();
    expect(response.body.assignedHr).toBeUndefined();
  });

  it('forbids HR from changing assignedHrId on update', async () => {
    const { agent } = await getIntegrationApp();
    const hrSession = await loginAsHr(agent);

    const created = await createInterview(agent, hrSession, seedQuestionId, {
      candidateName: 'HR Owned Update Test',
    }).expect(201);

    await agent
      .patch(`/interviews/${created.body.id}`)
      .set(authCookie(hrSession))
      .send({ assignedHrId: hrUserId })
      .expect(403);
  });

  it('rejects non-HR user as assignee', async () => {
    const { agent } = await getIntegrationApp();
    const adminSession = await loginAsSuperAdmin(agent);

    await createInterview(agent, adminSession, seedQuestionId, {
      assignedHrId: superAdminUserId,
    }).expect(400);
  });

  it.each([
    'in_progress',
    'processing',
    'completed',
    'failed',
  ] as InterviewStatus[])(
    'allows admin to assign HR on %s interview',
    async (status) => {
      const { app, agent } = await getIntegrationApp();
      const adminSession = await loginAsSuperAdmin(agent);

      const created = await createInterview(
        agent,
        adminSession,
        seedQuestionId,
      ).expect(201);

      await updateInterviewStatus(
        app.get(DatabaseService),
        created.body.id,
        status,
      );

      const response = await agent
        .patch(`/interviews/${created.body.id}`)
        .set(authCookie(adminSession))
        .send({ assignedHrId: hrUserId })
        .expect(200);

      expect(response.body.assignedHrId).toBe(hrUserId);
      expect(response.body.status).toBe(status);
    },
  );

  it('allows admin to clear HR assignment on completed interview', async () => {
    const { app, agent } = await getIntegrationApp();
    const adminSession = await loginAsSuperAdmin(agent);

    const created = await createInterview(
      agent,
      adminSession,
      seedQuestionId,
      { assignedHrId: hrUserId },
    ).expect(201);

    await updateInterviewStatus(
      app.get(DatabaseService),
      created.body.id,
      'completed',
    );

    const response = await agent
      .patch(`/interviews/${created.body.id}`)
      .set(authCookie(adminSession))
      .send({ assignedHrId: null })
      .expect(200);

    expect(response.body.assignedHrId).toBeUndefined();
    expect(response.body.assignedHr).toBeUndefined();
    expect(response.body.status).toBe('completed');
  });

  it('rejects mixed HR and candidate updates on non-pending interview', async () => {
    const { app, agent } = await getIntegrationApp();
    const adminSession = await loginAsSuperAdmin(agent);

    const created = await createInterview(
      agent,
      adminSession,
      seedQuestionId,
    ).expect(201);

    await updateInterviewStatus(
      app.get(DatabaseService),
      created.body.id,
      'in_progress',
    );

    await agent
      .patch(`/interviews/${created.body.id}`)
      .set(authCookie(adminSession))
      .send({ assignedHrId: hrUserId, candidateName: 'Too Late' })
      .expect(409);
  });
});
