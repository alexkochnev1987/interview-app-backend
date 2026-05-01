import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InterviewService } from '../interview/interview.service';
import { UploadService } from './upload.service';

@Controller('interviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'admin', 'hr')
export class RecruiterMediaController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly uploadService: UploadService,
  ) {}

  @Get(':id/questions/:questionIndex/media')
  async getAnswerMedia(
    @Param('id') id: string,
    @Param('questionIndex', ParseIntPipe) questionIndex: number,
  ) {
    const interview = await this.interviewService.findOne(id);
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
