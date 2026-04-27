import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateQuestionDto } from './dto/create-question.dto';
import { FindSimilarDto } from './dto/find-similar.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import {
  Question,
  SimilarQuestionMatch,
} from './interfaces/question.interface';
import { QuestionService } from './question.service';

@Controller('questions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'admin', 'hr')
export class QuestionController {
  constructor(private readonly questionService: QuestionService) {}

  @Get()
  findAll(): Promise<Question[]> {
    return this.questionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Question> {
    return this.questionService.findOne(id);
  }

  @Post()
  @Roles('super_admin', 'admin')
  create(@Body() dto: CreateQuestionDto): Promise<Question> {
    return this.questionService.create(dto);
  }

  @Post('similar')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async findSimilar(
    @Body() dto: FindSimilarDto,
  ): Promise<{ matches: SimilarQuestionMatch[] }> {
    const matches = await this.questionService.findSimilar(
      dto.draft ?? {},
      dto.limit ?? 5,
      dto.excludeQuestionId,
    );
    return { matches };
  }

  @Patch(':id')
  @Roles('super_admin', 'admin')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto,
  ): Promise<Question> {
    return this.questionService.update(id, dto);
  }
}
