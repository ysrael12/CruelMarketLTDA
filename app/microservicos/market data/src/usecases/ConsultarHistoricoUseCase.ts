import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { Negociacao } from "../domain/Negociacao";
import { NEGOCIACAO_REPOSITORY } from "../domain/ports/NegociacaoRepository";
import type { NegociacaoRepository } from "../domain/ports/NegociacaoRepository";

export const LIMITE_HISTORICO_PADRAO = 50;
export const LIMITE_HISTORICO_MAXIMO = 200;

@Injectable()
export class ConsultarHistoricoUseCase {
    constructor(
        @Inject(NEGOCIACAO_REPOSITORY)
        private readonly negociacoes: NegociacaoRepository,
    ) {}

    /** Negociações do ativo, da mais recente para a mais antiga. */
    async executar(
        ticker: string,
        limite: number = LIMITE_HISTORICO_PADRAO,
    ): Promise<Negociacao[]> {
        const tickerNormalizado = (ticker ?? "").trim().toUpperCase();
        if (tickerNormalizado === "") {
            throw new BadRequestException("ticker é obrigatório");
        }

        if (Number.isNaN(limite) || limite < 1) {
            throw new BadRequestException("limite deve ser um número maior que zero");
        }

        return this.negociacoes.listarPorTicker(
            tickerNormalizado,
            Math.min(Math.trunc(limite), LIMITE_HISTORICO_MAXIMO),
        );
    }
}