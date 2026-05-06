import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { createOpenApiDocument } from './openapi/swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const openApiDocument = createOpenApiDocument(app);

  SwaggerModule.setup('docs', app, openApiDocument);
  app.getHttpAdapter().getInstance().get('/openapi.json', (_req: Request, res: Response) => {
    res.json(openApiDocument);
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
