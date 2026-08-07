import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { AvatarController } from './avatar/avatar.controller';
import { AvatarService } from './avatar/avatar.service';
import { DatabaseModule } from '../database/database.module';
import { AuthGuardsModule } from '../auth/auth-guards.module';

@Module({
  imports: [DatabaseModule, AuthGuardsModule],
  controllers: [UserController, AvatarController],
  providers: [UserService, AvatarService],
  exports: [UserService],
})
export class UserModule {}
