import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { EventoMercado } from "../domain/EventoMercado";
import { EVENTO_MERCADO_REPOSITORY } from "../domain/ports/EventoMercadoRepository";
import type { EventoMercadoRepository } from "../domain/ports/EventoMercadoRepository";

export const LIMITE_EVENTOS_PADRAO = 20;
export const LIMITE_EVENTOS_MAXIMO = 100;

@Injectable()
export class ConsultarEventosUseCase {
    constructor(
        @Inject(EVENTO_MERCADO_REPOSITORY)
        private readonly eventos: EventoMercadoRepository,
    ) {}

    /** Histórico de eventos do mais recente para o mais antigo (RF14). */
    async executar(limite: number = LIMITE_EVENTOS_PADRAO): Promise<EventoMercado[]> {
        if (!Number.isFinite(limite) || limite < 1) {
            throw new BadRequestException("limite deve ser um número maior que zero");
        }

        return this.eventos.listar(Math.min(Math.trunc(limite), LIMITE_EVENTOS_MAXIMO));
    }
}
