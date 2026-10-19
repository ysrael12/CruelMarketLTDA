import { Controller, Get } from '@nestjs/common';

export interface SaudeServico {
  status: string;
  uptime: number;
}

@Controller('health')
export class HealthController {
  @Get()
  verificar(): SaudeServico {
    return { status: 'ok', uptime: process.uptime() };
  }
}
