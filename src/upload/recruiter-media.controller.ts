import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { InterviewService } from '../interview/interview.service';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/interfaces/user.interface';
import { InterviewAnswerMediaResponseDto } from './dto/upload.responses.dto';
import { ApiErrorResponseDto } from '../common/dto/api-error.response.dto';

@ApiTags('interviews')
@Controller('interviews')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RecruiterMediaController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly uploadService: UploadService,
  ) {}

  @Get(':id/questions/:questionIndex/media')
  @RequirePermissions('interviews:read_own')
  @ApiOperation({ summary: 'Get signed media URLs for interview answer' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'questionIndex' })
  @ApiOkResponse({ type: InterviewAnswerMediaResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
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
      answer.camera?.mediaKey
        ? this.uploadService
            .generateDownloadUrl(id, questionIndex, answer.camera.mediaKey)
            .then((res) => res.downloadUrl)
        : Promise.resolve(null),
      answer.screen?.mediaKey
        ? this.uploadService
            .generateDownloadUrl(id, questionIndex, answer.screen.mediaKey)
            .then((res) => res.downloadUrl)
        : Promise.resolve(null),
    ]);

    return {
      cameraUrl: camera,
      screenUrl: screen,
    };
  }
}
