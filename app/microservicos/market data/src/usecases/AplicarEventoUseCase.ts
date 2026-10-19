import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { Ativo } from "../domain/Ativo";
import { TipoEvento } from "../domain/EventoMercado";
import type { EventoMercado } from "../domain/EventoMercado";
import { ATIVO_REPOSITORY } from "../domain/ports/AtivoRepository";
import type { AtivoRepository } from "../domain/ports/AtivoRepository";
import { EVENTO_MERCADO_REPOSITORY } from "../domain/ports/EventoMercadoRepository";
import type { EventoMercadoRepository } from "../domain/ports/EventoMercadoRepository";
import { OrigemPreco, PUBLICADOR_PRECO } from "../domain/ports/PublicadorPreco";
import type { EventoPreco, PublicadorPreco } from "../domain/ports/PublicadorPreco";
import { AplicadorEvento } from "../domain/services/AplicadorEvento";
import { SequenciaMercado } from "../domain/services/SequenciaMercado";

@Injectable()
export class AplicarEventoUseCase {
    private readonly logger = new Logger(AplicarEventoUseCase.name);

    constructor(
        @Inject(ATIVO_REPOSITORY)
        private readonly ativos: AtivoRepository,
        @Inject(EVENTO_MERCADO_REPOSITORY)
        private readonly eventos: EventoMercadoRepository,
        @Inject(PUBLICADOR_PRECO)
        private readonly publicador: PublicadorPreco,
        private readonly aplicadorEvento: AplicadorEvento,
        private readonly sequencia: SequenciaMercado,
    ) {}

    /**
     * Persiste o evento e aplica o efeito nos ativos alvo (`ticker` nulo = todos).
     * O preço pós-evento é publicado porque ativo que faliu sai do tick e, sem isso,
     * o GAME OVER nunca chegaria ao cliente.
     */
    async executar(evento: EventoMercado, agora: Date = new Date()): Promise<void> {
        const ticker = this.tickerDoEvento(evento);
        const alvos = await this.alvos(ticker);
        await this.eventos.salvar(evento);

        this.logger.log(
            `EVENT_TRIGGERED evento=${evento.id} tipo=${evento.tipo} ticker=${ticker ?? "TODOS"} ativos=${alvos.length}`,
        );

        for (const ativo of alvos) {
            if (!ativo.estaAtivo()) {
                continue;
            }

            const precoAnterior = ativo.precoReferencia;
            const estavaAtivo = ativo.estaAtivo();

            this.aplicadorEvento.aplicar(evento, ativo);
            await this.ativos.salvar(ativo);

            this.logger.log(
                `PRICE_ADJUSTED evento=${evento.id} tipo=${evento.tipo} ticker=${ativo.ticker} ` +
                    `de=${precoAnterior} para=${ativo.precoReferencia}` +
                    (estavaAtivo && !ativo.estaAtivo()
                        ? ` status=${ativo.status} gameOver="${ativo.mensagemGameOver}"`
                        : ""),
            );

            await this.publicar(ativo, agora);
        }
    }

    private tickerDoEvento(evento: EventoMercado): string | null {
        if (!evento || typeof evento.tipo !== "string") {
            throw new BadRequestException("evento deve ter um tipo válido");
        }

        const bruto = evento.ticker;
        const ticker = typeof bruto === "string" && bruto.trim() !== "" ? bruto.trim().toUpperCase() : null;

        if (ticker === null && evento.tipo === TipoEvento.FALENCIA_FATAL) {
            throw new BadRequestException("falência fatal exige um ticker");
        }

        return ticker;
    }

    private async alvos(ticker: string | null): Promise<Ativo[]> {
        if (ticker === null) {
            return this.ativos.listar();
        }

        const ativo = await this.ativos.buscarPorTicker(ticker);
        if (!ativo) {
            throw new NotFoundException(`Ativo ${ticker} não encontrado`);
        }

        return [ativo];
    }

    private async publicar(ativo: Ativo, agora: Date): Promise<void> {
        if (!this.publicador.disponivel()) {
            return;
        }

        const evento: EventoPreco = {
            ativo: ativo.ticker,
            preco: ativo.precoReferencia,
            origem: OrigemPreco.TICK,
            sequencia: this.sequencia.proxima(),
            timestamp: agora.getTime(),
        };

        if (!ativo.estaAtivo()) {
            evento.status = ativo.status;
            evento.mensagemGameOver = ativo.mensagemGameOver;
        }

        await this.publicador.publicar(evento);
    }
}
