import { mkdir, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { createOpenApiDocument } from './swagger';

function ensureOpenApiEnvDefaults(): void {
  process.env.DATABASE_URL ||= 'postgresql://interview_app:localpass@localhost:5433/interview_app_dev';
  process.env.JWT_SECRET ||= 'openapi-local-secret';
  process.env.GOOGLE_CLIENT_ID ||= 'openapi-local-google-client-id';
  process.env.GOOGLE_CLIENT_SECRET ||= 'openapi-local-google-client-secret';
  process.env.GOOGLE_CALLBACK_URL ||= 'http://localhost:3000/auth/google/callback';
  process.env.FRONTEND_URL ||= 'http://localhost:3001';
}

async function generateOpenApi(): Promise<void> {
  ensureOpenApiEnvDefaults();
  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    const document = createOpenApiDocument(app);
    const outputPath = resolve(process.cwd(), 'openapi', 'openapi.json');
    await mkdir(resolve(process.cwd(), 'openapi'), { recursive: true });
    await writeFile(outputPath, JSON.stringify(document, null, 2), 'utf8');
    // eslint-disable-next-line no-console
    console.log(`OpenAPI spec generated at ${outputPath}`);
  } finally {
    await app.close();
  }
}

void generateOpenApi();
