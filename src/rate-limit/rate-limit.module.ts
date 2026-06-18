import { Global, Module } from '@nestjs/common';
import { ThrottlerModule, minutes } from '@nestjs/throttler';

@Global()
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: minutes(1),
        limit: 100,
      },
    ]),
  ],
  exports: [ThrottlerModule],
})
export class RateLimitModule {}
