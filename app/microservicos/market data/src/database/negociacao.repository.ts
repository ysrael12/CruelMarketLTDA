import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { Negociacao } from "../domain/Negociacao";
import type { NegociacaoRepository } from "../domain/ports/NegociacaoRepository";

@Injectable()
export class TypeOrmNegociacaoRepository implements NegociacaoRepository {
    constructor(
        @InjectRepository(Negociacao)
        private readonly repositorio: Repository<Negociacao>,
    ) {}

    async salvar(negociacao: Negociacao): Promise<void> {
        await this.repositorio.save(negociacao);
    }

    async listarPorTicker(ticker: string, limite: number): Promise<Negociacao[]> {
        return this.repositorio.find({
            where: { ticker },
            order: { executadaEm: "DESC", sequencia: "DESC" },
            take: limite,
        });
    }

    async volumePorTicker(): Promise<Map<string, number>> {
        const linhas = await this.repositorio
            .createQueryBuilder("negociacao")
            .select("negociacao.ticker", "ticker")
            .addSelect("SUM(negociacao.quantidade)", "volume")
            .groupBy("negociacao.ticker")
            .getRawMany<{ ticker: string; volume: number | string }>();

        return new Map(linhas.map((linha) => [linha.ticker, Number(linha.volume)]));
    }
}
