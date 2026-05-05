import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/interfaces/user.interface';
import { InterviewService } from '../interview/interview.service';
import { UploadService } from './upload.service';

@Controller('interviews')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RecruiterMediaController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly uploadService: UploadService,
  ) {}

  @Get(':id/questions/:questionIndex/media')
  @RequirePermissions('interviews:read_own')
  async getAnswerMedia(
    @Param('id') id: string,
    @Param('questionIndex', ParseIntPipe) questionIndex: number,
    @CurrentUser() user: Omit<User, 'passwordHash'>,
  ) {
    const interview = await this.interviewService.findOneForActor(id, user);
    const answer = interview.answers.find(
      (item) => item.questionIndex === questionIndex,
    );

    if (!answer) {
      throw new NotFoundException(
        `Answer for question ${questionIndex} is not available`,
      );
    }

    const [camera, screen] = await Promise.all([
      answer.mediaKey
        ? this.uploadService.generateDownloadUrl(
            id,
            questionIndex,
            answer.mediaKey,
          )
        : Promise.resolve(null),
      answer.screenMediaKey
        ? this.uploadService.generateDownloadUrl(
            id,
            questionIndex,
            answer.screenMediaKey,
          )
        : Promise.resolve(null),
    ]);

    return {
      questionIndex,
      cameraUrl: camera?.downloadUrl,
      screenUrl: screen?.downloadUrl,
    };
  }
}
