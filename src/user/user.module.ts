import { Module } from '@nestjs/common';

import { AuthGuardsModule } from '../auth/auth-guards.module';
import { DatabaseModule } from '../database/database.module';
import { AvatarStorageService } from './avatar/avatar-storage.service';
import { AvatarController } from './avatar/avatar.controller';
import { AvatarService } from './avatar/avatar.service';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [DatabaseModule, AuthGuardsModule],
  controllers: [UserController, AvatarController],
  providers: [UserService, AvatarService, AvatarStorageService],
  exports: [UserService, AvatarService, AvatarStorageService],
})
export class UserModule {}
