import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import supertest = require('supertest');
import { AppModule } from '../../src/app.module';
import { LoginThrottlerGuard } from '../../src/auth/guards/login-throttler.guard';
import { RegisterThrottlerGuard } from '../../src/auth/guards/register-throttler.guard';
import { DatabaseService } from '../../src/database/database.service';
import { QuestionService } from '../../src/question/question.service';
import { UserService } from '../../src/user/user.service';
import { truncateIntegrationTables } from './integration-db';

export type IntegrationAgent = ReturnType<typeof supertest.agent>;

export const INTEGRATION_USERS = {
  superAdmin: {
    email: 'admin@test.local',
    password: 'TestPass123!',
    name: 'Integration Super Admin',
    role: 'super_admin' as const,
  },
  admin: {
    email: 'staff-admin@test.local',
    password: 'TestPass123!',
    name: 'Integration Admin',
    role: 'admin' as const,
  },
  hr: {
    email: 'hr@test.local',
    password: 'TestPass123!',
    name: 'Integration HR',
    role: 'hr' as const,
  },
};

/** @deprecated use INTEGRATION_USERS.superAdmin */
export const INTEGRATION_ADMIN = INTEGRATION_USERS.superAdmin;

export type IntegrationFixtures = {
  superAdmin: { id: string; email: string; role: string };
  admin: { id: string; email: string; role: string };
  hr: { id: string; email: string; role: string };
  seedQuestionId: string;
};

let app: INestApplication | null = null;
let agent: IntegrationAgent | null = null;
let fixtures: IntegrationFixtures | null = null;

export async function getIntegrationApp(): Promise<{
  app: INestApplication;
  agent: IntegrationAgent;
  fixtures: IntegrationFixtures;
}> {
  if (!app || !agent || !fixtures) {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(LoginThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RegisterThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    );
    await app.init();
    agent = supertest.agent(app.getHttpServer());
    fixtures = await seedIntegrationFixtures(app);
  }

  return { app, agent, fixtures };
}

export async function closeIntegrationApp(): Promise<void> {
  if (app) {
    await app.close();
    app = null;
    agent = null;
    fixtures = null;
  }
}

export async function seedIntegrationFixtures(
  nestApp: INestApplication,
): Promise<IntegrationFixtures> {
  const databaseService = nestApp.get(DatabaseService);
  await truncateIntegrationTables(databaseService);

  const userService = nestApp.get(UserService);
  const questionService = nestApp.get(QuestionService);

  const superAdmin = await userService.create({
    ...INTEGRATION_USERS.superAdmin,
  });
  const admin = await userService.create({
    ...INTEGRATION_USERS.admin,
  });
  const hr = await userService.create({
    ...INTEGRATION_USERS.hr,
  });

  const seedQuestion = await questionService.create({
    questionText: 'Describe how you would debug a production API outage.',
    difficulty: 'medium',
    weight: 1,
    tags: ['integration-seed'],
  });

  return {
    superAdmin: {
      id: superAdmin.id,
      email: superAdmin.email,
      role: superAdmin.role,
    },
    admin: { id: admin.id, email: admin.email, role: admin.role },
    hr: { id: hr.id, email: hr.email, role: hr.role },
    seedQuestionId: seedQuestion.id,
  };
}

export function unauthenticatedRequest(nestApp: INestApplication) {
  return supertest(nestApp.getHttpServer());
}

export function extractSessionCookie(
  setCookie: string | string[] | undefined,
): string {
  const header = Array.isArray(setCookie)
    ? setCookie.join('; ')
    : (setCookie ?? '');
  const match = header.match(/session=([^;]+)/);
  if (!match?.[1]) {
    throw new Error('Expected session cookie in Set-Cookie response');
  }
  return `session=${match[1]}`;
}

export function parseCandidateToken(candidateLink: string): string {
  const token = new URL(candidateLink, 'http://localhost').searchParams.get(
    'token',
  );
  if (!token) {
    throw new Error(`Missing token in candidate link: ${candidateLink}`);
  }
  return token;
}
