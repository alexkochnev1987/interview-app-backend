import supertest = require('supertest');

import { getIntegrationApp } from '../helpers/integration-app';
import { authCookie, loginAsSuperAdmin } from '../helpers/integration-auth';
import { useIntegrationHarness } from '../helpers/integration-harness';
import { DatabaseService } from '../../src/database/database.service';
import { UserService } from '../../src/user/user.service';
import { QuestionService } from '../../src/question/question.service';
import { buildCreateQuestionPayload } from '../helpers/create-question-payload';

// Read-only demo account, end to end through Nest + Postgres + cookies/guards:
// reads are scoped to demo rows, every write is 403, and real data never leaks.
describe('Demo read-only account (integration)', () => {
  let seedQuestionId = '';
  useIntegrationHarness({
    onFixtures: (fixtures) => {
      seedQuestionId = fixtures.seedQuestionId;
    },
  });

  async function expectStatus(req: supertest.Test, status: number) {
    const res = await req;
    expect(res.status).toBe(status);
    return res;
  }

  it('scopes reads to demo rows, blocks every write, and never leaks real data', async () => {
    const { app } = await getIntegrationApp();
    const db = app.get(DatabaseService);
    const userService = app.get(UserService);
    const questionService = app.get(QuestionService);

    // Flag set directly; create() never sets it, mirroring how the real seed
    // runner stamps the column.
    const demoUser = await userService.create({
      email: 'demo-it@test.local',
      password: 'TestPass123!',
      name: 'Demo Integration',
      role: 'hr',
    });
    await db.query('UPDATE users SET demo = TRUE WHERE id = $1', [demoUser.id]);

    // Stamped demo further down: create() refuses to fold a demo question into a
    // non-demo actor's interview, so the demo interview fixture must reference it
    // while it is still a real row, then both get flipped together.
    const demoQuestion = await questionService.create(
      buildCreateQuestionPayload('Demo-only question for the integration test.', {
        difficulty: 'easy',
        weight: 1,
      }),
    );

    // A real interview owned by the super admin, plus a demo interview.
    const adminAgent = supertest.agent(app.getHttpServer());
    const adminSession = await loginAsSuperAdmin(adminAgent);

    const realInterview = await adminAgent
      .post('/interviews')
      .set(authCookie(adminSession))
      .send({
        candidateName: 'Real Candidate',
        position: 'Engineer',
        questionIds: [seedQuestionId],
      })
      .expect(201);
    const realInterviewId = realInterview.body.id as string;

    const demoInterview = await adminAgent
      .post('/interviews')
      .set(authCookie(adminSession))
      .send({
        candidateName: 'Demo Candidate',
        position: 'Engineer',
        questionIds: [demoQuestion.id],
      })
      .expect(201);
    const demoInterviewId = demoInterview.body.id as string;
    await db.query(
      'UPDATE interviews SET demo = TRUE, created_by_id = $2 WHERE id = $1',
      [demoInterviewId, demoUser.id],
    );
    await db.query('UPDATE questions SET demo = TRUE WHERE id = $1', [
      demoQuestion.id,
    ]);

    // Demo login (no credentials in the request).
    const demo = supertest.agent(app.getHttpServer());
    const login = await demo.post('/auth/demo').expect(200);
    expect(login.body.demo).toBe(true);
    expect(login.body.role).toBe('hr');

    const me = await demo.get('/auth/me').expect(200);
    expect(me.body.permissions).toEqual(
      expect.arrayContaining(['questions:read', 'interviews:read_own']),
    );
    expect(me.body.permissions).not.toContain('interviews:create');
    expect(me.body.permissions).not.toContain('interviews:update_own');
    expect(me.body.permissions).not.toContain('users:read');

    const questions = await demo.get('/questions').expect(200);
    const questionIds = questions.body.items.map((q: { id: string }) => q.id);
    expect(questionIds).toContain(demoQuestion.id);
    expect(questionIds).not.toContain(seedQuestionId);

    const interviews = await demo.get('/interviews').expect(200);
    const interviewIds = interviews.body.map((i: { id: string }) => i.id);
    expect(interviewIds).toContain(demoInterviewId);
    expect(interviewIds).not.toContain(realInterviewId);

    await demo.get(`/interviews/${demoInterviewId}`).expect(200);
    await demo.get(`/interviews/${realInterviewId}`).expect(403);
    await demo.get(`/questions/${seedQuestionId}`).expect(404);

    const createInterview = await expectStatus(
      demo.post('/interviews').send({
        candidateName: 'Nope',
        position: 'Nope',
        questionIds: [demoQuestion.id],
      }),
      403,
    );
    expect(String(createInterview.body.message)).toMatch(/read-only/i);

    await expectStatus(
      demo.post('/questions').send(
        buildCreateQuestionPayload('demo cannot create questions', {
          difficulty: 'easy',
          weight: 1,
        }),
      ),
      403,
    );
    await expectStatus(demo.post(`/interviews/${demoInterviewId}/validate`).send({}), 403);
    await expectStatus(
      demo.post(`/interviews/${demoInterviewId}/questions/0/validate`).send({}),
      403,
    );
    await expectStatus(demo.patch(`/interviews/${demoInterviewId}/complete`).send({}), 403);
    await expectStatus(demo.post(`/interviews/${demoInterviewId}/candidate-link`).send({}), 403);
    await expectStatus(demo.post(`/interviews/${demoInterviewId}/feedback-link`).send({}), 403);
    await expectStatus(demo.post('/ai/question-draft').send({ question: {} }), 403);
  });
});
