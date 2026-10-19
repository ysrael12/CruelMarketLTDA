import { describe, expect, test } from "bun:test";
import type { Channel } from "amqplib";
import type { EventoPreco } from "../domain/ports/PublicadorPreco";
import { OrigemPreco } from "../domain/ports/PublicadorPreco";
import { Particoes } from "./particoes";
import type { RabbitConexao } from "./rabbit.conexao";
import { RabbitPublicadorPreco } from "./rabbit.publicador-preco";

const EVENTO: EventoPreco = {
    ativo: "CRUS",
    preco: 120.5,
    origem: OrigemPreco.TICK,
    sequencia: 7,
    timestamp: Date.parse("2026-10-19T14:00:00.000Z"),
};

interface Publicacao {
    exchange: string;
    chave: string;
    conteudo: string;
    opcoes: Record<string, unknown>;
}

function criarPublicador(publicacoes: Publicacao[], conectado = true) {
    const canal = {
        publish: (exchange: string, chave: string, conteudo: Buffer, opcoes: Record<string, unknown>) => {
            publicacoes.push({ exchange, chave, conteudo: conteudo.toString(), opcoes });
            return true;
        },
        once: () => canal,
    };

    const conexao = {
        canalAtual: () => canal,
        estaConectado: () => conectado,
    } as unknown as RabbitConexao;

    return new RabbitPublicadorPreco(conexao, new Particoes());
}

describe("RabbitPublicadorPreco", () => {
    test("publica price.updated na exchange cruel.eventos com a partição do ativo", async () => {
        const publicacoes: Publicacao[] = [];
        const publicador = criarPublicador(publicacoes);

        await publicador.publicar(EVENTO);

        expect(publicacoes).toHaveLength(1);
        expect(publicacoes[0].exchange).toBe("cruel.eventos");
        expect(publicacoes[0].chave).toBe("price.updated.p1.crus");
        expect(JSON.parse(publicacoes[0].conteudo)).toEqual(EVENTO);
        expect(publicacoes[0].opcoes).toMatchObject({
            contentType: "application/json",
            persistent: true,
            messageId: "CRUS-7",
            timestamp: Math.floor(EVENTO.timestamp / 1000),
        });
    });

    test("informa indisponibilidade quando a conexão está fechada", () => {
        const publicador = criarPublicador([], false);

        expect(publicador.disponivel()).toBe(false);
    });

    test("informa disponibilidade quando a conexão está aberta", () => {
        expect(criarPublicador([]).disponivel()).toBe(true);
    });

    test("falha rápido quando o broker não está conectado", async () => {
        const conexao = {
            canalAtual: () => {
                throw new Error("RabbitMQ indisponível: nenhum canal aberto");
            },
        } as unknown as RabbitConexao;

        const publicador = new RabbitPublicadorPreco(conexao, new Particoes());

        await expect(publicador.publicar(EVENTO)).rejects.toThrow(/indisponível/);
    });
});
