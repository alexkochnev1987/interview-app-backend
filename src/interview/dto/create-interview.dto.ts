import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateInterviewDto {
  @IsString()
  @Length(1, 200)
  candidateName!: string;

  @IsOptional()
  @IsEmail()
  candidateEmail?: string;

  @IsString()
  @Length(1, 200)
  position!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  questionIds!: string[];
}
