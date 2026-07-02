import { ApiExtraModels, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { Locale } from '../../locale/locale.constants';
import { QuestionTranslationDto } from './question-translation.dto';

@ApiExtraModels(QuestionTranslationDto)
export class QuestionTranslationsMapDto {
  @ApiPropertyOptional({ type: () => QuestionTranslationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuestionTranslationDto)
  en?: QuestionTranslationDto;

  @ApiPropertyOptional({ type: () => QuestionTranslationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuestionTranslationDto)
  be?: QuestionTranslationDto;

  @ApiPropertyOptional({ type: () => QuestionTranslationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuestionTranslationDto)
  ru?: QuestionTranslationDto;

  @ApiPropertyOptional({ type: () => QuestionTranslationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuestionTranslationDto)
  pl?: QuestionTranslationDto;
}

export type QuestionTranslationsMapInput = Partial<
  Record<Locale, QuestionTranslationDto>
>;

export function asQuestionTranslationsMapInput(
  map: QuestionTranslationsMapDto,
): QuestionTranslationsMapInput {
  return map as QuestionTranslationsMapInput;
}
