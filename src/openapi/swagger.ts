import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SUPPORTED_LOCALES } from '../locale/locale.constants';

export function createOpenApiDocument(app: INestApplication) {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Interview App API')
    .setDescription(
      'Interview App backend API. i18n: `docs/locale-and-api.md`. ' +
        'Spec: `openapi/openapi.json` (`npm run openapi:check`). ' +
        'Global `X-Locale` (en|be|ru|pl, default en). Errors: `code` in `src/common/errors/api-error.registry.ts`.',
    )
    .setVersion('1.0.0')
    .addGlobalParameters({
      name: 'X-Locale',
      in: 'header',
      required: false,
      description:
        'Response language for localized content. Defaults to `en` when omitted.',
      schema: {
        type: 'string',
        enum: [...SUPPORTED_LOCALES],
        default: 'en',
      },
    })
    .addCookieAuth('session', { type: 'apiKey', in: 'cookie' }, 'sessionAuth')
    .addCookieAuth(
      'candidate_session',
      { type: 'apiKey', in: 'cookie' },
      'candidateSessionAuth',
    )
    .build();

  return SwaggerModule.createDocument(app, swaggerConfig);
}
