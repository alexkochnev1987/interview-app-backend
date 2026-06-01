import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

function queryBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  return undefined;
}

export class GetQuestionQueryDto {
  @ApiPropertyOptional({
    description: 'When true, include the full translations map. Default false.',
  })
  @IsOptional()
  @Transform(({ value }) => queryBoolean(value))
  @IsBoolean()
  includeTranslations?: boolean;
}
