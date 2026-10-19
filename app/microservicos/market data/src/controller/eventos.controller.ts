import { BadRequestException, Body, Controller, DefaultValuePipe, Get, ParseIntPipe, Post, Query } from '@nestjs/common';
import { TipoEvento } from '../domain/EventoMercado';
import type { EventoMercado } from '../domain/EventoMercado';
import { GeradorEventos } from '../domain/services/GeradorEventos';
import { AplicarEventoUseCase } from '../usecases/AplicarEventoUseCase';
import { ConsultarEventosUseCase, LIMITE_EVENTOS_PADRAO } from '../usecases/ConsultarEventosUseCase';

export interface DispararEventoDto {
  tipo: TipoEvento;
  /** Nulo aplica o evento em todos os ativos. */
  ticker?: string | null;
  duracaoSegundos?: number;
}

const DURACAO_MAXIMA_SEGUNDOS = 120;

@Controller('eventos')
export class EventosController {
  constructor(
    private readonly consultarEventos: ConsultarEventosUseCase,
    private readonly aplicarEvento: AplicarEventoUseCase,
    private readonly gerador: GeradorEventos,
  ) {}

  @Get()
  listar(
    @Query('limite', new DefaultValuePipe(LIMITE_EVENTOS_PADRAO), ParseIntPipe) limite: number,
  ): Promise<EventoMercado[]> {
    return this.consultarEventos.executar(limite);
  }

  /** Comando de administrador para disparar um evento na hora (RF22). */
  @Post()
  async disparar(@Body() dto: DispararEventoDto): Promise<{ id: string; tipo: TipoEvento; ticker: string | null }> {
    const tipo = this.tipoValido(dto?.tipo);
    const duracaoMs = this.duracaoValida(dto?.duracaoSegundos);
    const evento = this.gerador.criar(tipo, dto?.ticker ?? null, new Date(), duracaoMs);

    await this.aplicarEvento.executar(evento);

    return { id: evento.id, tipo: evento.tipo, ticker: evento.ticker };
  }

  private tipoValido(tipo: unknown): TipoEvento {
    if (!Object.values(TipoEvento).includes(tipo as TipoEvento)) {
      throw new BadRequestException(
        `tipo deve ser um de: ${Object.values(TipoEvento).join(', ')}`,
      );
    }
    return tipo as TipoEvento;
  }

  private duracaoValida(duracaoSegundos: unknown): number | undefined {
    if (duracaoSegundos === undefined || duracaoSegundos === null) {
      return undefined;
    }
    if (typeof duracaoSegundos !== 'number' || duracaoSegundos <= 0 || duracaoSegundos > DURACAO_MAXIMA_SEGUNDOS) {
      throw new BadRequestException(`duracaoSegundos deve estar entre 1 e ${DURACAO_MAXIMA_SEGUNDOS}`);
    }
    return duracaoSegundos * 1000;
  }
}
