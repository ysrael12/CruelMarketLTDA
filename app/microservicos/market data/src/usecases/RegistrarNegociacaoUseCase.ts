import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { EventoTrade } from "../broker/EventoTrade";
import { Negociacao } from "../domain/Negociacao";
import { ATIVO_REPOSITORY } from "../domain/ports/AtivoRepository";
import type { AtivoRepository } from "../domain/ports/AtivoRepository";
import { NEGOCIACAO_REPOSITORY } from "../domain/ports/NegociacaoRepository";
import type { NegociacaoRepository } from "../domain/ports/NegociacaoRepository";
import { OrigemPreco, PUBLICADOR_PRECO } from "../domain/ports/PublicadorPreco";
import type { PublicadorPreco } from "../domain/ports/PublicadorPreco";
import { AtualizadorUltimoPreco } from "../domain/services/AtualizadorUltimoPreco";
import { SequenciaMercado } from "../domain/services/SequenciaMercado";

function exigirTexto(valor: unknown, campo: string): string {
    if (typeof valor !== "string" || valor.trim() === "") {
        throw new BadRequestException(`${campo} é obrigatório`);
    }
    return valor.trim();
}

function exigirInteiroPositivo(valor: unknown, campo: string): number {
    if (typeof valor !== "number" || !Number.isInteger(valor) || valor <= 0) {
        throw new BadRequestException(`${campo} deve ser um inteiro maior que zero`);
    }
    return valor;
}

function exigirPreco(valor: unknown, campo: string): number {
    if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) {
        throw new BadRequestException(`${campo} deve ser um número maior que zero`);
    }
    return valor;
}

@Injectable()
export class RegistrarNegociacaoUseCase {
    constructor(
        @Inject(ATIVO_REPOSITORY)
        private readonly ativos: AtivoRepository,
        @Inject(NEGOCIACAO_REPOSITORY)
        private readonly negociacoes: NegociacaoRepository,
        @Inject(PUBLICADOR_PRECO)
        private readonly publicador: PublicadorPreco,
        private readonly atualizadorUltimoPreco: AtualizadorUltimoPreco,
        private readonly sequencia: SequenciaMercado,
    ) {}

    /**
     * Persiste a negociação, promove o preço ao último negócio e publica o novo preço.
     * Retorna `null` quando o ativo faliu: a execução é descartada. Sem broker, a
     * negociação continua sendo gravada e apenas a publicação é omitida.
     */
    async executar(evento: EventoTrade): Promise<Negociacao | null> {
        const ticker = exigirTexto(evento?.ativo, "ativo").toUpperCase();
        const ordemCompraId = exigirTexto(evento.ordemCompraId, "ordemCompraId");
        const ordemVendaId = exigirTexto(evento.ordemVendaId, "ordemVendaId");
        const quantidade = exigirInteiroPositivo(evento.quantidade, "quantidade");
        const preco = exigirPreco(evento.preco, "preco");
        if (typeof evento.timestamp !== "number" || !Number.isFinite(evento.timestamp)) {
            throw new BadRequestException("timestamp deve ser um epoch em milissegundos");
        }

        const ativo = await this.ativos.buscarPorTicker(ticker);
        if (!ativo) {
            throw new NotFoundException(`Ativo ${ticker} não encontrado`);
        }
        if (!ativo.estaAtivo()) {
            return null;
        }

        const negociacao = new Negociacao();
        negociacao.ticker = ativo.ticker;
        negociacao.ativo = ativo;
        negociacao.ordemCompraId = ordemCompraId;
        negociacao.ordemVendaId = ordemVendaId;
        negociacao.quantidade = quantidade;
        negociacao.preco = preco;
        negociacao.executadaEm = new Date(evento.timestamp);
        negociacao.sequencia = this.sequencia.proxima();

        await this.negociacoes.salvar(negociacao);

        this.atualizadorUltimoPreco.aplicar(ativo, negociacao);
        await this.ativos.salvar(ativo);

        if (!this.publicador.disponivel()) {
            return negociacao;
        }

        await this.publicador.publicar({
            ativo: ativo.ticker,
            preco: ativo.precoExibido(),
            origem: OrigemPreco.NEGOCIO,
            sequencia: negociacao.sequencia,
            timestamp: negociacao.executadaEm.getTime(),
        });

        return negociacao;
    }
}