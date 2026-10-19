import { Inject, Injectable } from "@nestjs/common";
import { ATIVO_REPOSITORY } from "../domain/ports/AtivoRepository";
import type { AtivoRepository } from "../domain/ports/AtivoRepository";
import { NEGOCIACAO_REPOSITORY } from "../domain/ports/NegociacaoRepository";
import type { NegociacaoRepository } from "../domain/ports/NegociacaoRepository";
import type { ResumoAtivo } from "./ResumoAtivo";

@Injectable()
export class ConsultarAtivosUseCase {
    constructor(
        @Inject(ATIVO_REPOSITORY)
        private readonly ativos: AtivoRepository,
        @Inject(NEGOCIACAO_REPOSITORY)
        private readonly negociacoes: NegociacaoRepository,
    ) {}

    /** Catálogo em ordem alfabética, com último preço, variação e volume negociado. */
    async executar(): Promise<ResumoAtivo[]> {
        const [ativos, volumes] = await Promise.all([
            this.ativos.listar(),
            this.negociacoes.volumePorTicker(),
        ]);

        return ativos.map((ativo) => ({
            ticker: ativo.ticker,
            ultimoPreco: ativo.precoExibido(),
            variacaoPercentual: ativo.variacaoPercentual(),
            volume: volumes.get(ativo.ticker) ?? 0,
        }));
    }
}