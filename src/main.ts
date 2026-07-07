import './types/express-augment';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
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

  app.useGlobalFilters(new ApiExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
