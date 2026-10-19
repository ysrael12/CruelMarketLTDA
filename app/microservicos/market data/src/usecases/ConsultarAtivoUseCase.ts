import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Ativo } from "../domain/Ativo";
import { ATIVO_REPOSITORY } from "../domain/ports/AtivoRepository";
import type { AtivoRepository } from "../domain/ports/AtivoRepository";

@Injectable()
export class ConsultarAtivoUseCase {
    constructor(
        @Inject(ATIVO_REPOSITORY)
        private readonly ativos: AtivoRepository,
    ) {}

    /** Detalhe de um ativo do catálogo; 400 para ticker vazio e 404 para ticker inexistente. */
    async executar(ticker: string): Promise<Ativo> {
        const tickerNormalizado = (ticker ?? "").trim().toUpperCase();
        if (tickerNormalizado === "") {
            throw new BadRequestException("ticker é obrigatório");
        }

        const ativo = await this.ativos.buscarPorTicker(tickerNormalizado);
        if (!ativo) {
            throw new NotFoundException(`Ativo ${tickerNormalizado} não encontrado`);
        }

        return ativo;
    }
}