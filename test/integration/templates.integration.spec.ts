import supertest from 'supertest';

import { DatabaseService } from '../../src/database/database.service';
import { QuestionService } from '../../src/question/question.service';
import { UserService } from '../../src/user/user.service';
import { buildCreateQuestionPayload } from '../helpers/create-question-payload';
import { getIntegrationApp } from '../helpers/integration-app';
import { authCookie, loginAsSuperAdmin } from '../helpers/integration-auth';
import { useIntegrationHarness } from '../helpers/integration-harness';

// Templates end to end: staff CRUD plus usage tracking, and demo accounts reading demo rows only.
describe('Interview templates (integration)', () => {
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

  it('supports the full CRUD lifecycle and usage tracking for a staff user', async () => {
    const { app } = await getIntegrationApp();
    const agent = supertest.agent(app.getHttpServer());
    const session = await loginAsSuperAdmin(agent);

    const created = await agent
      .post('/templates')
      .set(authCookie(session))
      .send({
        name: 'Frontend Fundamentals',
        description: 'First-round screen',
        position: 'Frontend Engineer',
        questionIds: [seedQuestionId],
      })
      .expect(201);
    const templateId = created.body.id as string;
    expect(created.body.questions).toHaveLength(1);
    expect(created.body.questionCount).toBe(1);
    expect(created.body.usageCount).toBe(0);
    expect(created.body.demo).toBe(false);

    const list = await agent
      .get('/templates')
      .set(authCookie(session))
      .expect(200);
    expect(list.body.map((t: { id: string }) => t.id)).toContain(templateId);

    const fetched = await agent
      .get(`/templates/${templateId}`)
      .set(authCookie(session))
      .expect(200);
    expect(fetched.body.name).toBe('Frontend Fundamentals');

    // Partial update keeps unchanged fields (question set stays intact).
    const updated = await agent
      .patch(`/templates/${templateId}`)
      .set(authCookie(session))
      .send({ name: 'Frontend Fundamentals v2' })
      .expect(200);
    expect(updated.body.name).toBe('Frontend Fundamentals v2');
    expect(updated.body.questionCount).toBe(1);

    // Creating an interview from the template bumps its popularity; usage is
    // recorded server-side in the same transaction, not by a separate call.
    await agent
      .post('/interviews')
      .set(authCookie(session))
      .send({
        candidateName: 'Casey Candidate',
        position: 'Frontend Engineer',
        questionIds: [seedQuestionId],
        templateId,
      })
      .expect(201);
    const afterUse = await agent
      .get(`/templates/${templateId}`)
      .set(authCookie(session))
      .expect(200);
    expect(afterUse.body.usageCount).toBe(1);

    // An empty question set is rejected by validation.
    await expectStatus(
      agent
        .post('/templates')
        .set(authCookie(session))
        .send({ name: 'Empty', questionIds: [] }),
      400,
    );

    await agent
      .delete(`/templates/${templateId}`)
      .set(authCookie(session))
      .expect(200);
    await agent
      .get(`/templates/${templateId}`)
      .set(authCookie(session))
      .expect(404);
  });

  it('lets a demo account read templates but blocks every write, scoped to demo rows', async () => {
    const { app } = await getIntegrationApp();
    const db = app.get(DatabaseService);
    const userService = app.get(UserService);
    const questionService = app.get(QuestionService);

    const demoUser = await userService.create({
      email: 'demo-templates-it@test.local',
      password: 'TestPass123!',
      name: 'Demo Templates Integration',
      role: 'hr',
    });
    await db.query('UPDATE users SET demo = TRUE WHERE id = $1', [demoUser.id]);

    const demoQuestion = await questionService.create(
      buildCreateQuestionPayload('Demo-only template question.', {
        difficulty: 'easy',
        weight: 1,
      }),
    );

    const adminAgent = supertest.agent(app.getHttpServer());
    const adminSession = await loginAsSuperAdmin(adminAgent);

    // A real template owned by staff, plus a demo template (flag flipped after
    // creation, like the real seed runner stamps the column).
    const realTemplate = await adminAgent
      .post('/templates')
      .set(authCookie(adminSession))
      .send({ name: 'Real Template', questionIds: [seedQuestionId] })
      .expect(201);
    const realTemplateId = realTemplate.body.id as string;

    const demoTemplate = await adminAgent
      .post('/templates')
      .set(authCookie(adminSession))
      .send({ name: 'Demo Template', questionIds: [demoQuestion.id] })
      .expect(201);
    const demoTemplateId = demoTemplate.body.id as string;
    await db.query(
      'UPDATE interview_templates SET demo = TRUE, created_by_id = $2 WHERE id = $1',
      [demoTemplateId, demoUser.id],
    );
    await db.query('UPDATE questions SET demo = TRUE WHERE id = $1', [
      demoQuestion.id,
    ]);

    const demo = supertest.agent(app.getHttpServer());
    const login = await demo.post('/auth/demo').expect(200);
    expect(login.body.demo).toBe(true);

    // Reads are scoped to demo rows; the real template never leaks.
    const list = await demo.get('/templates').expect(200);
    const ids = list.body.map((t: { id: string }) => t.id);
    expect(ids).toContain(demoTemplateId);
    expect(ids).not.toContain(realTemplateId);

    await demo.get(`/templates/${demoTemplateId}`).expect(200);
    await demo.get(`/templates/${realTemplateId}`).expect(404);

    // Every write is 403 in read-only mode.
    await expectStatus(
      demo
        .post('/templates')
        .send({ name: 'Nope', questionIds: [demoQuestion.id] }),
      403,
    );
    await expectStatus(
      demo.patch(`/templates/${demoTemplateId}`).send({ name: 'Nope' }),
      403,
    );
    await expectStatus(demo.delete(`/templates/${demoTemplateId}`), 403);
    // Usage is only ever recorded through interview creation, which demo accounts
    // cannot perform, so they can never inflate a template's popularity.
    await expectStatus(
      demo.post('/interviews').send({
        candidateName: 'Nope',
        position: 'Nope',
        questionIds: [demoQuestion.id],
        templateId: demoTemplateId,
      }),
      403,
    );
  });
});
