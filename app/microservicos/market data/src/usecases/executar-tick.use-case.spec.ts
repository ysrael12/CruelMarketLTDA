import "reflect-metadata";
import { describe, expect, test } from "bun:test";
import { Ativo, Categoria, PerfilPreco, StatusAtivo } from "../domain/Ativo";
import type { AtivoRepository } from "../domain/ports/AtivoRepository";
import { OrigemPreco } from "../domain/ports/PublicadorPreco";
import type { EventoPreco } from "../domain/ports/PublicadorPreco";
import { PoliticaFixo } from "../domain/services/PoliticaFixo";
import { PoliticaRandomWalk } from "../domain/services/PoliticaRandomWalk";
import type { PoliticasPorPerfil } from "../domain/services/RelogioMercado";
import { RelogioMercado } from "../domain/services/RelogioMercado";
import { SequenciaMercado } from "../domain/services/SequenciaMercado";
import { ExecutarTickUseCase } from "./ExecutarTickUseCase";

const AGORA = new Date("2026-10-19T14:00:00.000Z");

function criarAtivo(
    ticker: string,
    precoReferencia: number,
    status: StatusAtivo = StatusAtivo.ATIVO,
): Ativo {
    return Object.assign(new Ativo(), {
        ticker,
        nome: ticker,
        descricao: "",
        categoria: Categoria.ACAO,
        perfil: PerfilPreco.RANDOM_WALK,
        piso: 1,
        teto: 10_000,
        precoReferencia,
        ultimoPreco: null,
        status,
        faseCiclo: 0,
        cicloSegundos: null,
        podeFalir: false,
        mensagemGameOver: "",
    });
}

function criarCenario(ativos: Ativo[], brokerDisponivel = true) {
    const salvos: Ativo[] = [];
    const publicados: EventoPreco[] = [];

    const repositorio: AtivoRepository = {
        salvar: async (ativo) => {
            salvos.push(ativo);
        },
        buscarPorTicker: async (ticker) => ativos.find((ativo) => ativo.ticker === ticker) ?? null,
        listar: async () => ativos,
    };

    // amplitude 0,02 com sorteio sempre máximo => +1% por tick
    const politicas: PoliticasPorPerfil = {
        [PerfilPreco.BLUECHIP]: new PoliticaFixo(),
        [PerfilPreco.CICLO]: new PoliticaFixo(),
        [PerfilPreco.RANDOM_WALK]: new PoliticaRandomWalk(0.02, () => 1),
        [PerfilPreco.FIXO]: new PoliticaFixo(),
    };

    const useCase = new ExecutarTickUseCase(
        repositorio,
        {
            publicar: async (evento) => void publicados.push(evento),
            disponivel: () => brokerDisponivel,
        },
        new RelogioMercado({ politicas, intervaloTickMs: 1000 }),
        new SequenciaMercado(),
    );

    return { useCase, salvos, publicados };
}

describe("ExecutarTickUseCase", () => {
    test("movimenta o preço de referência, salva e publica um evento por ativo", async () => {
        const crus = criarAtivo("CRUS", 50);
        const gdhd = criarAtivo("GDHD", 30);
        const { useCase, salvos, publicados } = criarCenario([crus, gdhd]);

        const eventos = await useCase.executar(AGORA);

        expect(crus.precoReferencia).toBe(50.5);
        expect(gdhd.precoReferencia).toBe(30.3);
        expect(salvos).toEqual([crus, gdhd]);
        expect(eventos).toEqual([
            { ativo: "CRUS", preco: 50.5, origem: OrigemPreco.TICK, sequencia: 1, timestamp: AGORA.getTime() },
            { ativo: "GDHD", preco: 30.3, origem: OrigemPreco.TICK, sequencia: 2, timestamp: AGORA.getTime() },
        ]);
        expect(publicados).toEqual(eventos);
    });

    test("não movimenta nem publica ativo falido", async () => {
        const gaga = criarAtivo("GAGA", 20, StatusAtivo.FALIDO);
        const { useCase, salvos, publicados } = criarCenario([gaga]);

        const eventos = await useCase.executar(AGORA);

        expect(eventos).toEqual([]);
        expect(publicados).toEqual([]);
        expect(salvos).toEqual([]);
        expect(gaga.precoReferencia).toBe(20);
    });

    test("não publica nem salva duas vezes dentro do intervalo do relógio", async () => {
        const { useCase, salvos, publicados } = criarCenario([criarAtivo("CRUS", 50)]);

        await useCase.executar(AGORA);
        const segunda = await useCase.executar(AGORA);

        expect(segunda).toEqual([]);
        expect(salvos).toHaveLength(1);
        expect(publicados).toHaveLength(1);
    });

    test("volta a publicar quando o intervalo vence", async () => {
        const crus = criarAtivo("CRUS", 50);
        const { useCase, publicados } = criarCenario([crus]);

        await useCase.executar(AGORA);
        await useCase.executar(new Date(AGORA.getTime() + 1000));

        expect(publicados.map((evento) => evento.preco)).toEqual([50.5, 51.01]);
        expect(publicados.map((evento) => evento.sequencia)).toEqual([1, 2]);
    });

    test("publica a sequência global compartilhada", async () => {
        const { useCase } = criarCenario([criarAtivo("CRUS", 50), criarAtivo("GDHD", 30)]);

        const primeira = await useCase.executar(AGORA);
        const segunda = await useCase.executar(new Date(AGORA.getTime() + 1000));

        expect([...primeira, ...segunda].map((evento) => evento.sequencia)).toEqual([1, 2, 3, 4]);
    });

    test("sem broker, atualiza e salva o preço sem publicar", async () => {
        const crus = criarAtivo("CRUS", 50);
        const { useCase, salvos, publicados } = criarCenario([crus], false);

        const eventos = await useCase.executar(AGORA);

        expect(crus.precoReferencia).toBe(50.5);
        expect(salvos).toEqual([crus]);
        expect(eventos).toEqual([]);
        expect(publicados).toEqual([]);
    });
});
