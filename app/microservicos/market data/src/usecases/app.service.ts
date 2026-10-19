import { Injectable } from '@nestjs/common';

export interface InfoServico {
  servico: string;
  status: string;
}

@Injectable()
export class AppService {
  obterInfo(): InfoServico {
    return { servico: 'market-data', status: 'ok' };
  }
}
