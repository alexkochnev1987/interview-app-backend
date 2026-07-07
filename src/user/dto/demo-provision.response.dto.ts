import { ApiProperty } from '@nestjs/swagger';
import { AuthUserResponseDto } from '../../auth/dto/auth-user.response.dto';

export class DemoProvisionCountsDto {
  @ApiProperty({ example: 1 })
  users!: number;

  @ApiProperty({ example: 3 })
  questions!: number;

  @ApiProperty({ example: 1 })
  interviews!: number;
}

export class DemoProvisionResponseDto {
  @ApiProperty({ type: AuthUserResponseDto })
  user!: AuthUserResponseDto;

  @ApiProperty({ type: DemoProvisionCountsDto })
  counts!: DemoProvisionCountsDto;
}
