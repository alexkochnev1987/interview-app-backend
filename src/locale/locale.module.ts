import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { LocaleMiddleware } from './locale.middleware';

@Module({})
export class LocaleModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LocaleMiddleware).forRoutes('*');
  }
}
