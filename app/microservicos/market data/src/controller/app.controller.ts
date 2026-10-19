import { Controller, Get } from '@nestjs/common';
import { AppService, type InfoServico } from '../usecases/app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  obterInfo(): InfoServico {
    return this.appService.obterInfo();
  }
}
