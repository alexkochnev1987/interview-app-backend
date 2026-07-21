import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateIf,
} from 'class-validator';

export class UpdateInterviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  candidateName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  candidateEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  position?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description:
      'HR reviewer UUID, or null to clear assignment. Admin/super_admin only.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assignedHrId?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((item) => (typeof item === 'string' ? item.trim() : item))
      : value,
  )
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayUnique()
  questionIds?: string[];
}
