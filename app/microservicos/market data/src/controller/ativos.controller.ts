import { Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import type { Ativo } from '../domain/Ativo';
import type { Negociacao } from '../domain/Negociacao';
import { ConsultarAtivoUseCase } from '../usecases/ConsultarAtivoUseCase';
import { ConsultarAtivosUseCase } from '../usecases/ConsultarAtivosUseCase';
import { ConsultarHistoricoUseCase, LIMITE_HISTORICO_PADRAO } from '../usecases/ConsultarHistoricoUseCase';
import type { ResumoAtivo } from '../usecases/ResumoAtivo';

@Controller('ativos')
export class AtivosController {
  constructor(
    private readonly consultarAtivos: ConsultarAtivosUseCase,
    private readonly consultarAtivo: ConsultarAtivoUseCase,
    private readonly consultarHistorico: ConsultarHistoricoUseCase,
  ) {}

  @Get()
  listar(): Promise<ResumoAtivo[]> {
    return this.consultarAtivos.executar();
  }

  @Get(':ticker')
  detalhar(@Param('ticker') ticker: string): Promise<Ativo> {
    return this.consultarAtivo.executar(ticker);
  }

  @Get(':ticker/historico')
  historico(
    @Param('ticker') ticker: string,
    @Query('limite', new DefaultValuePipe(LIMITE_HISTORICO_PADRAO), ParseIntPipe) limite: number,
  ): Promise<Negociacao[]> {
    return this.consultarHistorico.executar(ticker, limite);
  }
}
