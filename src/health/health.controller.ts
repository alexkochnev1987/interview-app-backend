import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthResponseDto } from './dto/health.response.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiOkResponse({ type: HealthResponseDto })
  check(): { status: string; message: string; timestamp: Date } {
    return {
      status: 'ok',
      message: 'Lightsail backend is serving the latest deploy.',
      timestamp: new Date(),
    };
  }
}
