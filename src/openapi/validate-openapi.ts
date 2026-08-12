import { resolve } from 'path';

import SwaggerParser from '@apidevtools/swagger-parser';

async function validateOpenApi(): Promise<void> {
  const specPath = resolve(process.cwd(), 'openapi', 'openapi.json');
  await SwaggerParser.validate(specPath);
  // eslint-disable-next-line no-console
  console.log(`OpenAPI spec is valid: ${specPath}`);
}

void validateOpenApi();
