import { Inject, Injectable } from "@nestjs/common";
import { ATIVO_REPOSITORY } from "../domain/ports/AtivoRepository";
import type { AtivoRepository } from "../domain/ports/AtivoRepository";
import { OrigemPreco, PUBLICADOR_PRECO } from "../domain/ports/PublicadorPreco";
import type { EventoPreco, PublicadorPreco } from "../domain/ports/PublicadorPreco";
import { RelogioMercado } from "../domain/services/RelogioMercado";
import { SequenciaMercado } from "../domain/services/SequenciaMercado";

@Injectable()
export class ExecutarTickUseCase {
    constructor(
        @Inject(ATIVO_REPOSITORY)
        private readonly ativos: AtivoRepository,
        @Inject(PUBLICADOR_PRECO)
        private readonly publicador: PublicadorPreco,
        private readonly relogio: RelogioMercado,
        private readonly sequencia: SequenciaMercado,
    ) {}

    /**
     * Movimenta o preço de referência de todos os ativos ativos e publica os que mudaram.
     * O relógio limita cada ativo a um tick por intervalo, então chamadas repetidas não
     * geram evento nem escrita extra. Sem broker, o preço continua sendo atualizado e
     * apenas a publicação é omitida.
     */
    async executar(agora: Date = new Date()): Promise<EventoPreco[]> {
        const publicados: EventoPreco[] = [];

        for (const ativo of await this.ativos.listar()) {
            if (!ativo.estaAtivo()) {
                continue;
            }

            const precoAnterior = ativo.precoReferencia;
            const faseAnterior = ativo.faseCiclo;
            this.relogio.tick(ativo, agora);

            const precoMudou = ativo.precoReferencia !== precoAnterior;
            if (!precoMudou && ativo.faseCiclo === faseAnterior) {
                continue;
            }

            await this.ativos.salvar(ativo);
            if (!precoMudou || !this.publicador.disponivel()) {
                continue;
            }

            const evento: EventoPreco = {
                ativo: ativo.ticker,
                preco: ativo.precoReferencia,
                origem: OrigemPreco.TICK,
                sequencia: this.sequencia.proxima(),
                timestamp: agora.getTime(),
            };

            await this.publicador.publicar(evento);
            publicados.push(evento);
        }

        return publicados;
    }
}
