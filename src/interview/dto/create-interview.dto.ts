import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

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

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayUnique()
  questionIds: string[];
}
