import { Injectable, Logger } from "@nestjs/common";
import type { Channel, ConsumeMessage } from "amqplib";
import type { EventoTrade } from "./EventoTrade";
import { RegistrarNegociacaoUseCase } from "../usecases/RegistrarNegociacaoUseCase";
import {
    CHAVE_DLQ,
    EXCHANGE_DLX,
    EXCHANGE_EVENTOS,
    FILA_DLQ,
    FILA_MERCADO,
    TRADE_EXECUTED,
} from "./nomes";
import { RabbitConexao } from "./rabbit.conexao";

/** Consome `trade.executed` e entrega cada execução ao `RegistrarNegociacaoUseCase`. */
@Injectable()
export class TradeExecutedConsumer {
    private readonly logger = new Logger(TradeExecutedConsumer.name);

    constructor(
        private readonly conexao: RabbitConexao,
        private readonly registrarNegociacao: RegistrarNegociacaoUseCase,
    ) {
        // No construtor: o preparador precisa existir antes da primeira conexão do RabbitConexao.
        this.conexao.registrarPreparador((canal) => this.preparar(canal));
    }

    /** Declara a topologia e registra o consumo; roda de novo a cada reconexão. */
    async preparar(canal: Channel): Promise<void> {
        await canal.assertExchange(EXCHANGE_EVENTOS, "topic", { durable: true });
        await canal.assertExchange(EXCHANGE_DLX, "direct", { durable: true });
        await canal.assertQueue(FILA_DLQ, { durable: true });
        await canal.bindQueue(FILA_DLQ, EXCHANGE_DLX, CHAVE_DLQ);

        await canal.assertQueue(FILA_MERCADO, {
            durable: true,
            deadLetterExchange: EXCHANGE_DLX,
            deadLetterRoutingKey: CHAVE_DLQ,
        });
        await canal.bindQueue(FILA_MERCADO, EXCHANGE_EVENTOS, `${TRADE_EXECUTED}.*.*`);
        await canal.prefetch(10);

        await canal.consume(FILA_MERCADO, (mensagem) => void this.processar(canal, mensagem));
        this.logger.log(`consumindo ${TRADE_EXECUTED} na fila ${FILA_MERCADO}`);
    }

    private async processar(canal: Channel, mensagem: ConsumeMessage | null): Promise<void> {
        if (mensagem === null) {
            return; // consumo cancelado pelo broker
        }

        try {
            const evento = this.lerMensagem(mensagem);
            const negociacao = await this.registrarNegociacao.executar(evento);

            canal.ack(mensagem);

            if (negociacao === null) {
                this.logger.warn(`execução descartada: ativo ${evento.ativo} está falido`);
            }
        } catch (erro) {
            const motivo = erro instanceof Error ? erro.message : String(erro);
            this.logger.error(`execução recusada (mensagem enviada para ${FILA_DLQ}): ${motivo}`);
            canal.nack(mensagem, false, false);
        }
    }

    private lerMensagem(mensagem: ConsumeMessage): EventoTrade {
        return JSON.parse(mensagem.content.toString()) as EventoTrade;
    }
}
