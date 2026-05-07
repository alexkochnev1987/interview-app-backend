import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function createOpenApiDocument(app: INestApplication) {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Interview App API')
    .setDescription('HTTP API contract for Interview App backend')
    .setVersion('1.0.0')
    .addCookieAuth('session', { type: 'apiKey', in: 'cookie' }, 'sessionAuth')
    .addCookieAuth(
      'candidate_session',
      { type: 'apiKey', in: 'cookie' },
      'candidateSessionAuth',
    )
    .build();

  return SwaggerModule.createDocument(app, swaggerConfig);
}
