import { ApiProperty } from '@nestjs/swagger';

/** Minimal, non-sensitive shape for the interview-creation candidate lookup —
 *  deliberately not the full user record. */
export class CandidateSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;
}
