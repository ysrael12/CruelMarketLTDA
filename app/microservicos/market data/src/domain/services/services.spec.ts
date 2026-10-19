import "reflect-metadata";
import { describe, expect, test } from "bun:test";
import { Ativo, Categoria, PerfilPreco, StatusAtivo } from "../Ativo";
import { EventoMercado, TipoEvento } from "../EventoMercado";
import { Negociacao } from "../Negociacao";
import { AplicadorEvento } from "./AplicadorEvento";
import { AtualizadorUltimoPreco } from "./AtualizadorUltimoPreco";
import { PoliticaFixo } from "./PoliticaFixo";
import { PoliticaBluechip } from "./PoliticaBluechip";
import { PoliticaCiclo } from "./PoliticaCiclo";
import { PoliticaRandomWalk } from "./PoliticaRandomWalk";
import { PoliticaPreco } from "./PoliticaPreco";
import { PoliticasPorPerfil, RelogioMercado, politicasPadrao } from "./RelogioMercado";
import { criarGeradorSemeado } from "./aleatorio";

function criarAtivo(overrides: Partial<Ativo> = {}): Ativo {
    return Object.assign(new Ativo(), {
        ticker: "ACME3",
        nome: "ACME",
        categoria: Categoria.ACAO,
        perfil: PerfilPreco.RANDOM_WALK,
        piso: 10,
        teto: 100,
        precoReferencia: 50,
        ultimoPreco: null,
        status: StatusAtivo.ATIVO,
        faseCiclo: 0,
        cicloSegundos: null,
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

    test("bluechip nunca cai e sobe no melhor sorteio", () => {
        const ativo = criarAtivo();

        expect(new PoliticaBluechip(0.001, 0.004, 0.001, () => 0).proximoPreco(ativo)).toBe(50);
        expect(new PoliticaBluechip(0.001, 0.004, 0.001, () => 1).proximoPreco(ativo)).toBe(50.25);
    });

    test("ciclo percorre piso e teto conforme a fase", () => {
        const ativo = criarAtivo({ perfil: PerfilPreco.CICLO, cicloSegundos: 20 });
        const politica = new PoliticaCiclo(0, 40, () => 0.5);

        expect(politica.proximoPreco(ativo)).toBe(55);
        ativo.atualizarFaseCiclo(0.25);
        expect(politica.proximoPreco(ativo)).toBe(100);
        ativo.atualizarFaseCiclo(0.75);
        expect(politica.proximoPreco(ativo)).toBe(10);
    });

    test("ciclo avanca a fase em um ciclo completo por cicloSegundos", () => {
        const ativo = criarAtivo({ perfil: PerfilPreco.CICLO, cicloSegundos: 20 });
        const politica = new PoliticaCiclo(0, 40, () => 0.5);

        politica.avancar(ativo, 5000);
        expect(ativo.faseCiclo).toBeCloseTo(0.25, 10);

        politica.avancar(ativo, 15000);
        expect(ativo.faseCiclo).toBeCloseTo(0, 10);
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

    test("avanca a fase do ciclo a cada tick", () => {
        const ativo = criarAtivo({ perfil: PerfilPreco.CICLO, cicloSegundos: 20 });
        const relogio = new RelogioMercado({ politicas: politicasPadrao(() => 0.5) });

        relogio.tick(ativo, new Date(1000));

        expect(ativo.faseCiclo).toBeCloseTo(0.05, 10);
    });

    test("seed reproduz a mesma sequencia de precos", () => {
        const serie = (semente: number): number[] => {
            const ativo = criarAtivo({ perfil: PerfilPreco.RANDOM_WALK });
            const relogio = new RelogioMercado({
                politicas: politicasPadrao(criarGeradorSemeado(semente)),
                intervaloTickMs: 0,
            });

            return Array.from({ length: 10 }, (_, indice) =>
                relogio.tick(ativo, new Date((indice + 1) * 1000)),
            );
        };

        expect(serie(42)).toEqual(serie(42));
        expect(serie(42)).not.toEqual(serie(7));
    });

    test("gerador semeado produz valores em [0,1)", () => {
        const gerador = criarGeradorSemeado(1);
        const valores = Array.from({ length: 100 }, () => gerador());

        expect(valores.every((valor) => valor >= 0 && valor < 1)).toBe(true);
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

    test("recusa falencia fatal em ativo que nao pode falir", () => {
        const ativo = criarAtivo({ ticker: "CRUS", podeFalir: false });
        const evento = criarEvento({ tipo: TipoEvento.FALENCIA_FATAL, ticker: "CRUS" });

        expect(() => new AplicadorEvento().aplicar(evento, ativo)).toThrow();
        expect(ativo.estaAtivo()).toBe(true);
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

        expect(ativo.precoExibido()).toBe(50);

        new AtualizadorUltimoPreco().aplicar(ativo, criarNegociacao({ preco: 60 }));
        expect(ativo.ultimoPreco).toBe(60);
        expect(ativo.precoExibido()).toBe(60);

        new AtualizadorUltimoPreco().aplicar(ativo, criarNegociacao({ preco: 500 }));
        expect(ativo.ultimoPreco).toBe(100);
    });

    test("ignora negociacao de ativo falido", () => {
        const ativo = criarAtivo({ status: StatusAtivo.FALIDO });

        new AtualizadorUltimoPreco().aplicar(ativo, criarNegociacao({ preco: 60 }));

        expect(ativo.ultimoPreco).toBeNull();
    });
});
