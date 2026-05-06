import SwaggerParser from '@apidevtools/swagger-parser';
import { resolve } from 'path';

async function validateOpenApi(): Promise<void> {
  const specPath = resolve(process.cwd(), 'openapi', 'openapi.json');
  await SwaggerParser.validate(specPath);
  // eslint-disable-next-line no-console
  console.log(`OpenAPI spec is valid: ${specPath}`);
}

void validateOpenApi();
