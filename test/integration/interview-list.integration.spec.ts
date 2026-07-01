import { DatabaseService } from '../../src/database/database.service';
import supertest = require('supertest');
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

async function createInterview(
  agent: IntegrationAgent,
  session: string,
  questionId: string,
  overrides: { candidateName?: string; position?: string } = {},
): Promise<string> {
  const response = await agent
    .post('/interviews')
    .set(authCookie(session))
    .send({
      candidateName: overrides.candidateName ?? 'List Test Candidate',
      position: overrides.position ?? 'Engineer',
      questionIds: [questionId],
    })
    .expect(201);

  return response.body.id as string;
}

// Thin integration layer: Nest + Postgres + cookies/guards for list endpoints.
// Filter and projection rules live in unit specs under src/interview/.
describe('Interview list API (integration)', () => {
  let seedQuestionId = '';

  useIntegrationHarness({
    onFixtures: (fixtures) => {
      seedQuestionId = fixtures.seedQuestionId;
    },
  });

  it('wires paginated list to return slim InterviewListItem rows', async () => {
    const { agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);

    await createInterview(agent, session, seedQuestionId, {
      candidateName: 'Alice List',
      position: 'Engineer',
    });
    await createInterview(agent, session, seedQuestionId, {
      candidateName: 'Bob List',
      position: 'Designer',
    });

    const response = await agent
      .get('/interviews')
      .query({ page: 1, limit: 10, sortBy: 'updatedAt', sortOrder: 'desc' })
      .set(authCookie(session))
      .expect(200);

    expect(response.body).toMatchObject({
      total: 2,
      page: 1,
      limit: 10,
    });
    expect(response.body.items).toHaveLength(2);

    const item = response.body.items[0];
    expect(item).toMatchObject({
      candidateName: expect.any(String),
      position: expect.any(String),
      status: 'pending',
      questionCount: 1,
      submittedAnswerCount: 0,
    });
    expect(item).not.toHaveProperty('questions');
    expect(item).not.toHaveProperty('answers');
    expect(item).not.toHaveProperty('workflow');
  });

  it('wires list filters and facets with Postgres', async () => {
    const { app, agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);
    const databaseService = app.get(DatabaseService);

    await createInterview(agent, session, seedQuestionId, {
      candidateName: 'Alice Pending',
      position: 'Engineer',
    });
    const completedInterviewId = await createInterview(agent, session, seedQuestionId, {
      candidateName: 'Bob Complete',
      position: 'Designer',
    });
    await updateInterviewStatus(
      databaseService,
      completedInterviewId,
      'completed',
    );

    const list = await agent
      .get('/interviews')
      .query({ status: 'completed' })
      .set(authCookie(session))
      .expect(200);

    expect(list.body.total).toBe(1);
    expect(list.body.items[0]).toMatchObject({
      candidateName: 'Bob Complete',
      status: 'completed',
      position: 'Designer',
    });

    const facets = await agent
      .get('/interviews/facets')
      .query({ status: 'completed' })
      .set(authCookie(session))
      .expect(200);

    expect(facets.body.positions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'Designer', count: 1 }),
      ]),
    );
    expect(
      facets.body.statuses.some(
        (entry: { value: string }) => entry.value === 'pending',
      ),
    ).toBe(true);
  });

  it('wires HR list ownership scoping with Postgres', async () => {
    const { app, agent } = await getIntegrationApp();
    const adminSession = await loginAsSuperAdmin(agent);

    await createInterview(agent, adminSession, seedQuestionId, {
      candidateName: 'Admin Owned Interview',
    });

    const hrAgent = supertest.agent(app.getHttpServer());
    const hrSession = await loginAsHr(hrAgent);

    await createInterview(hrAgent, hrSession, seedQuestionId, {
      candidateName: 'HR Owned Interview',
    });

    const hrList = await hrAgent
      .get('/interviews')
      .set(authCookie(hrSession))
      .expect(200);

    expect(hrList.body.total).toBe(1);
    expect(hrList.body.items[0].candidateName).toBe('HR Owned Interview');
  });
});
