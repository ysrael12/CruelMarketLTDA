import "reflect-metadata";
import { describe, expect, test } from "bun:test";
import { Ativo, Categoria, PerfilPreco, StatusAtivo } from "../Ativo";
import { EventoMercado, TipoEvento } from "../EventoMercado";
import { Negociacao } from "../Negociacao";
import { AplicadorEvento } from "./AplicadorEvento";
import { AtualizadorUltimoPreco } from "./AtualizadorUltimoPreco";
import { PoliticaFixo } from "./PoliticaFixo";
import { PoliticaRandomWalk } from "./PoliticaRandomWalk";
import { PoliticaPreco } from "./PoliticaPreco";
import { PoliticasPorPerfil, RelogioMercado } from "./RelogioMercado";

function criarAtivo(overrides: Partial<Ativo> = {}): Ativo {
    return Object.assign(new Ativo(), {
        ticker: "ACME3",
        nome: "ACME",
        categoria: Categoria.ACAO,
        perfil: PerfilPreco.RANDOM_WALK,
        piso: 10,
        teto: 100,
        precoReferencia: 50,
        ultimoPreco: 50,
        status: StatusAtivo.ATIVO,
        podeFalir: true,
        mensagemGameOver: "A ACME faliu",
        ...overrides,
    });
}

function criarEvento(overrides: Partial<EventoMercado> = {}): EventoMercado {
    return Object.assign(new EventoMercado(), {
        id: "evento-1",
        tipo: TipoEvento.CRASH,
        ticker: "ACME3",
        anunciadoEm: new Date("2026-01-01T00:00:00Z"),
        inicio: new Date("2026-01-01T00:00:05Z"),
        fim: new Date("2026-01-01T00:01:00Z"),
        ...overrides,
    });
}

function criarNegociacao(overrides: Partial<Negociacao> = {}): Negociacao {
    return Object.assign(new Negociacao(), {
        id: "negociacao-1",
        ticker: "ACME3",
        ordemCompraId: "compra-1",
        ordemVendaId: "venda-1",
        quantidade: 10,
        preco: 60,
        executadaEm: new Date("2026-01-01T00:00:00Z"),
        sequencia: 1,
        ...overrides,
    });
}

function politicasCom(politica: PoliticaPreco): PoliticasPorPerfil {
    return {
        [PerfilPreco.BLUECHIP]: politica,
        [PerfilPreco.CICLO]: politica,
        [PerfilPreco.RANDOM_WALK]: politica,
        [PerfilPreco.FIXO]: politica,
    };
}

describe("politicas de preco", () => {
    test("fixo mantem o preco de referencia", () => {
        const ativo = criarAtivo();

        expect(new PoliticaFixo().proximoPreco(ativo)).toBe(50);
    });

    test("random walk respeita a faixa do ativo", () => {
        const ativo = criarAtivo();

        expect(new PoliticaRandomWalk(2, () => 1).proximoPreco(ativo)).toBe(100);
        expect(new PoliticaRandomWalk(2, () => 0).proximoPreco(ativo)).toBe(10);
    });
});

describe("relogio de mercado", () => {
    test("aplica a politica no maximo uma vez por intervalo", () => {
        const ativo = criarAtivo();
        const politica: PoliticaPreco = {
            proximoPreco: (a) => a.precoReferencia + 1,
        };
        const relogio = new RelogioMercado({
            politicas: politicasCom(politica),
            intervaloTickMs: 1000,
        });

        expect(relogio.tick(ativo, new Date(1000))).toBe(51);
        expect(relogio.tick(ativo, new Date(1500))).toBe(51);
        expect(relogio.tick(ativo, new Date(2000))).toBe(52);
    });

    test("nao movimenta ativo falido", () => {
        const ativo = criarAtivo({ status: StatusAtivo.FALIDO });
        const politica: PoliticaPreco = {
            proximoPreco: (a) => a.precoReferencia + 1,
        };

        expect(new RelogioMercado({ politicas: politicasCom(politica) }).tick(ativo, new Date())).toBe(50);
    });
});

describe("aplicador de evento", () => {
    test("crash derruba o preco de referencia", () => {
        const ativo = criarAtivo();
        const evento = criarEvento();

        new AplicadorEvento().aplicar(evento, ativo);

        expect(ativo.precoReferencia).toBe(40);
        expect(evento.estaVigente(new Date("2026-01-01T00:00:10Z"))).toBe(true);
    });

    test("falencia fatal marca o ativo como falido", () => {
        const ativo = criarAtivo();
        const evento = criarEvento({ tipo: TipoEvento.FALENCIA_FATAL });

        new AplicadorEvento().aplicar(evento, ativo);

        expect(ativo.status).toBe(StatusAtivo.FALIDO);
        expect(ativo.estaAtivo()).toBe(false);
    });

    test("recusa evento de outro ativo", () => {
        const ativo = criarAtivo();
        const evento = criarEvento({ ticker: "OUTRA3" });

        expect(() => new AplicadorEvento().aplicar(evento, ativo)).toThrow();
    });
});

describe("atualizador de ultimo preco", () => {
    test("usa o preco da negociacao e limita a faixa", () => {
        const ativo = criarAtivo();

        new AtualizadorUltimoPreco().aplicar(ativo, criarNegociacao({ preco: 60 }));
        expect(ativo.ultimoPreco).toBe(60);

        new AtualizadorUltimoPreco().aplicar(ativo, criarNegociacao({ preco: 500 }));
        expect(ativo.ultimoPreco).toBe(100);
    });

    test("ignora negociacao de ativo falido", () => {
        const ativo = criarAtivo({ status: StatusAtivo.FALIDO });

        new AtualizadorUltimoPreco().aplicar(ativo, criarNegociacao({ preco: 60 }));

        expect(ativo.ultimoPreco).toBe(50);
    });
});
