import { describe, expect, test } from "bun:test";
import { Ativo, Categoria, PerfilPreco, StatusAtivo } from "../Ativo";
import { TipoEvento } from "../EventoMercado";
import { GeradorEventos, TIPOS_REGULARES } from "./GeradorEventos";
import { criarGeradorSemeado } from "./aleatorio";

const AGORA = new Date("2026-10-19T14:00:00.000Z");

function criarAtivo(ticker: string, podeFalir = false): Ativo {
    return Object.assign(new Ativo(), {
        ticker,
        nome: ticker,
        descricao: "",
        categoria: Categoria.ACAO,
        perfil: PerfilPreco.FIXO,
        piso: 1,
        teto: 100,
        precoReferencia: 10,
        ultimoPreco: null,
        status: StatusAtivo.ATIVO,
        faseCiclo: 0,
        cicloSegundos: null,
        podeFalir,
        mensagemGameOver: podeFalir ? "GAME OVER" : "",
    });
}

const ALVOS = [criarAtivo("CRUS"), criarAtivo("GDHD")];

describe("GeradorEventos", () => {
    test("sorteia um tipo regular e um ativo, com briefing antes do efeito", () => {
        const gerador = new GeradorEventos({ aleatorio: () => 0 });

        const evento = gerador.criarRegular(ALVOS, AGORA);

        expect(TIPOS_REGULARES).toContain(evento.tipo);
        expect(evento.tipo).toBe(TipoEvento.FRENZY);
        expect(evento.ticker).toBe("CRUS");
        expect(evento.anunciadoEm).toEqual(AGORA);
        expect(evento.inicio.getTime() - AGORA.getTime()).toBe(5_000);
        expect(evento.fim.getTime() - evento.inicio.getTime()).toBe(15_000);
    });

    test("nunca sorteia FALENCIA_FATAL entre os eventos regulares (RF12)", () => {
        const gerador = new GeradorEventos({ aleatorio: criarGeradorSemeado(7) });

        const eventos = Array.from({ length: 50 }, () => gerador.criarRegular(ALVOS, AGORA));

        expect(eventos.every((evento) => evento.tipo !== TipoEvento.FALENCIA_FATAL)).toBe(true);
        expect(new Set(eventos.map((evento) => evento.tipo)).size).toBe(TIPOS_REGULARES.length);
    });

    test("intervalo entre eventos fica em 45–90 s e a duração em 15–30 s", () => {
        const minimo = new GeradorEventos({ aleatorio: () => 0 });
        const maximo = new GeradorEventos({ aleatorio: () => 0.999999 });

        expect(minimo.proximoIntervaloMs()).toBe(45_000);
        expect(maximo.proximoIntervaloMs()).toBeGreaterThan(89_000);
        expect(maximo.proximoIntervaloMs()).toBeLessThanOrEqual(90_000);

        const evento = maximo.criarRegular(ALVOS, AGORA);
        expect(evento.fim.getTime() - evento.inicio.getTime()).toBeLessThanOrEqual(30_000);
        expect(evento.fim.getTime() - evento.inicio.getTime()).toBeGreaterThan(29_000);
    });

    test("agenda a falência uma única vez, entre 2 e 5 min, só em ativo que pode falir", () => {
        const gerador = new GeradorEventos({ aleatorio: () => 0 });
        const candidatos = [criarAtivo("GAGA", true), criarAtivo("GTC", true)];

        const evento = gerador.criarFalencia(candidatos, AGORA);

        expect(evento.tipo).toBe(TipoEvento.FALENCIA_FATAL);
        expect(["GAGA", "GTC"]).toContain(evento.ticker!);
        expect(evento.inicio.getTime() - AGORA.getTime()).toBe(120_000);
        expect(evento.anunciadoEm.getTime()).toBe(evento.inicio.getTime() - 5_000);
    });

    test("evento de administrador é imediato e respeita a duração pedida (RF22)", () => {
        const gerador = new GeradorEventos({ aleatorio: () => 0.5 });

        const evento = gerador.criar(TipoEvento.CRASH, "CRUS", AGORA, 10_000);

        expect(evento.inicio).toEqual(AGORA);
        expect(evento.fim.getTime() - AGORA.getTime()).toBe(10_000);
        expect(evento.ticker).toBe("CRUS");
    });

    test("recusa criar evento sem ativo disponível", () => {
        const gerador = new GeradorEventos();

        expect(() => gerador.criarRegular([], AGORA)).toThrow(/não há ativo/);
        expect(() => gerador.criarFalencia([], AGORA)).toThrow(/não há ativo/);
    });

    test("com a mesma seed, os eventos sorteados se repetem (RNF05)", () => {
        const primeiro = new GeradorEventos({ aleatorio: criarGeradorSemeado(42) });
        const segundo = new GeradorEventos({ aleatorio: criarGeradorSemeado(42) });

        const serie = (gerador: GeradorEventos) =>
            Array.from({ length: 5 }, () => {
                const evento = gerador.criarRegular(ALVOS, AGORA);
                return `${evento.tipo}:${evento.ticker}:${evento.fim.getTime()}`;
            });

        expect(serie(primeiro)).toEqual(serie(segundo));
    });
});
