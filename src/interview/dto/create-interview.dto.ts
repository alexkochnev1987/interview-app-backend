import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../../locale/locale.constants';
import { Locale } from '../../locale/locale.constants';

export class CreateInterviewDto {
  @ApiProperty()
  @IsString()
  @Length(1, 200)
  candidateName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  candidateEmail?: string;

  @ApiProperty()
  @IsString()
  @Length(1, 200)
  position: string;

  @ApiPropertyOptional({
    enum: SUPPORTED_LOCALES,
    default: DEFAULT_LOCALE,
    description: 'Locale for interview UI and feedback. Defaults to en when omitted.',
  })
  @IsOptional()
  @IsIn([...SUPPORTED_LOCALES])
  interviewLocale?: Locale;

  @ApiProperty({ type: [String] })
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((v) => (typeof v === 'string' ? v.trim() : v))
      : value,
  )
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayUnique()
  questionIds: string[];
}
