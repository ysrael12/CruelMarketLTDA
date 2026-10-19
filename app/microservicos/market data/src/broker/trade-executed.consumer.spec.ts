import "reflect-metadata";
import { describe, expect, test } from "bun:test";
import type { Channel, ConsumeMessage } from "amqplib";
import type { EventoTrade } from "./EventoTrade";
import type { RabbitConexao } from "./rabbit.conexao";
import { TradeExecutedConsumer } from "./trade-executed.consumer";
import type { RegistrarNegociacaoUseCase } from "../usecases/RegistrarNegociacaoUseCase";

const EVENTO: EventoTrade = {
    ordemCompraId: "compra-1",
    ordemVendaId: "venda-1",
    ativo: "CRUS",
    quantidade: 10,
    preco: 120,
    timestamp: Date.parse("2026-10-19T14:00:00.000Z"),
};

interface Chamadas {
    assertExchange: unknown[][];
    assertQueue: unknown[][];
    bindQueue: unknown[][];
    prefetch: unknown[][];
    acks: ConsumeMessage[];
    nacks: Array<{ mensagem: ConsumeMessage; requeue: boolean }>;
}

function criarCanal(chamadas: Chamadas, consumidor: { callback?: (mensagem: ConsumeMessage | null) => void }) {
    const canal = {
        assertExchange: async (...args: unknown[]) => void chamadas.assertExchange.push(args),
        assertQueue: async (...args: unknown[]) => void chamadas.assertQueue.push(args),
        bindQueue: async (...args: unknown[]) => void chamadas.bindQueue.push(args),
        prefetch: async (...args: unknown[]) => void chamadas.prefetch.push(args),
        consume: async (_fila: string, callback: (mensagem: ConsumeMessage | null) => void) => {
            consumidor.callback = callback;
            return { consumerTag: "tag" };
        },
        ack: (mensagem: ConsumeMessage) => void chamadas.acks.push(mensagem),
        nack: (mensagem: ConsumeMessage, _allUpTo?: boolean, requeue?: boolean) =>
            void chamadas.nacks.push({ mensagem, requeue: requeue ?? false }),
    };

    return canal as unknown as Channel;
}

function criarCenario(executar: (evento: EventoTrade) => Promise<unknown>) {
    const chamadas: Chamadas = {
        assertExchange: [],
        assertQueue: [],
        bindQueue: [],
        prefetch: [],
        acks: [],
        nacks: [],
    };
    const consumidor: { callback?: (mensagem: ConsumeMessage | null) => void } = {};
    const eventos: EventoTrade[] = [];

    const conexao = { registrarPreparador: () => {} } as unknown as RabbitConexao;
    const useCase = {
        executar: async (evento: EventoTrade) => {
            eventos.push(evento);
            return executar(evento);
        },
    } as unknown as RegistrarNegociacaoUseCase;

    const consumer = new TradeExecutedConsumer(conexao, useCase);
    const canal = criarCanal(chamadas, consumidor);

    return { consumer, canal, chamadas, consumidor, eventos };
}

function mensagem(corpo: unknown): ConsumeMessage {
    return { content: Buffer.from(JSON.stringify(corpo)) } as ConsumeMessage;
}

async function aguardar(condicao: () => boolean): Promise<void> {
    for (let tentativa = 0; tentativa < 100 && !condicao(); tentativa += 1) {
        await new Promise((resolver) => setTimeout(resolver, 5));
    }
}

describe("TradeExecutedConsumer", () => {
    test("declara a fila com DLQ e assina trade.executed de todas as partições", async () => {
        const { consumer, canal, chamadas } = criarCenario(async () => null);

        await consumer.preparar(canal);

        expect(chamadas.assertExchange).toContainEqual(["cruel.eventos", "topic", { durable: true }]);
        expect(chamadas.assertExchange).toContainEqual(["cruel.dlx", "direct", { durable: true }]);
        expect(chamadas.assertQueue).toContainEqual(["cruel.dlq", { durable: true }]);
        expect(chamadas.assertQueue).toContainEqual([
            "q.mercado",
            {
                durable: true,
                deadLetterExchange: "cruel.dlx",
                deadLetterRoutingKey: "dead",
            },
        ]);
        expect(chamadas.bindQueue).toContainEqual(["cruel.dlq", "cruel.dlx", "dead"]);
        expect(chamadas.bindQueue).toContainEqual(["q.mercado", "cruel.eventos", "trade.executed.*.*"]);
        expect(chamadas.prefetch).toEqual([[10]]);
    });

    test("registra a negociação e confirma a mensagem", async () => {
        const { consumer, canal, chamadas, consumidor, eventos } = criarCenario(async () => ({ id: "n1" }));
        await consumer.preparar(canal);

        const entrega = mensagem(EVENTO);
        consumidor.callback?.(entrega);
        await aguardar(() => chamadas.acks.length > 0);

        expect(eventos).toEqual([EVENTO]);
        expect(chamadas.acks).toEqual([entrega]);
        expect(chamadas.nacks).toEqual([]);
    });

    test("envia para a DLQ a execução recusada", async () => {
        const { consumer, canal, chamadas, consumidor } = criarCenario(async () => {
            throw new Error("Ativo ZZZZ não encontrado");
        });
        await consumer.preparar(canal);

        const entrega = mensagem(EVENTO);
        consumidor.callback?.(entrega);
        await aguardar(() => chamadas.nacks.length > 0);

        expect(chamadas.acks).toEqual([]);
        expect(chamadas.nacks).toEqual([{ mensagem: entrega, requeue: false }]);
    });

    test("descarta mensagem com JSON inválido sem confirmar", async () => {
        const { consumer, canal, chamadas, consumidor } = criarCenario(async () => null);
        await consumer.preparar(canal);

        const entrega = { content: Buffer.from("nao é json") } as ConsumeMessage;
        consumidor.callback?.(entrega);
        await aguardar(() => chamadas.nacks.length > 0);

        expect(chamadas.acks).toEqual([]);
        expect(chamadas.nacks).toHaveLength(1);
    });
});
