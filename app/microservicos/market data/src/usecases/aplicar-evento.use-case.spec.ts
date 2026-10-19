import "reflect-metadata";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { TypeOrmModule, getRepositoryToken } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { TypeOrmAtivoRepository } from "../database/ativo.repository";
import { TypeOrmEventoMercadoRepository } from "../database/evento-mercado.repository";
import { Ativo, Categoria, PerfilPreco, StatusAtivo } from "../domain/Ativo";
import { EventoMercado, TipoEvento } from "../domain/EventoMercado";
import { ATIVO_REPOSITORY } from "../domain/ports/AtivoRepository";
import { EVENTO_MERCADO_REPOSITORY } from "../domain/ports/EventoMercadoRepository";
import { OrigemPreco, PUBLICADOR_PRECO } from "../domain/ports/PublicadorPreco";
import type { EventoPreco } from "../domain/ports/PublicadorPreco";
import { AplicadorEvento } from "../domain/services/AplicadorEvento";
import { SequenciaMercado } from "../domain/services/SequenciaMercado";
import { AplicarEventoUseCase } from "./AplicarEventoUseCase";

const AGORA = new Date("2026-10-19T14:00:00.000Z");
const PUBLICADOS: EventoPreco[] = [];
let brokerDisponivel = true;

const publicadorFalso = {
    publicar: async (evento: EventoPreco): Promise<void> => {
        PUBLICADOS.push(evento);
    },
    disponivel: () => brokerDisponivel,
};

function criarAtivo(
    ticker: string,
    precoReferencia: number,
    alteracoes: Partial<Ativo> = {},
): Ativo {
    return Object.assign(new Ativo(), {
        ticker,
        nome: ticker,
        descricao: "",
        categoria: Categoria.ACAO,
        perfil: PerfilPreco.FIXO,
        piso: 1,
        teto: 10_000,
        precoReferencia,
        ultimoPreco: null,
        status: StatusAtivo.ATIVO,
        faseCiclo: 0,
        cicloSegundos: null,
        podeFalir: false,
        mensagemGameOver: "",
        ...alteracoes,
    });
}

function criarEvento(alteracoes: Partial<EventoMercado> = {}): EventoMercado {
    return Object.assign(new EventoMercado(), {
        tipo: TipoEvento.CRASH,
        ticker: "CRUS",
        anunciadoEm: new Date("2026-10-19T13:59:55.000Z"),
        inicio: new Date("2026-10-19T14:00:00.000Z"),
        fim: new Date("2026-10-19T14:00:30.000Z"),
        ...alteracoes,
    });
}

let modulo: TestingModule;
let useCase: AplicarEventoUseCase;
let ativos: Repository<Ativo>;
let eventos: Repository<EventoMercado>;

beforeAll(async () => {
    modulo = await Test.createTestingModule({
        imports: [
            TypeOrmModule.forRoot({
                type: "better-sqlite3",
                database: ":memory:",
                synchronize: true,
                entities: [Ativo, EventoMercado],
            }),
            TypeOrmModule.forFeature([Ativo, EventoMercado]),
        ],
        providers: [
            TypeOrmAtivoRepository,
            TypeOrmEventoMercadoRepository,
            { provide: ATIVO_REPOSITORY, useExisting: TypeOrmAtivoRepository },
            { provide: EVENTO_MERCADO_REPOSITORY, useExisting: TypeOrmEventoMercadoRepository },
            { provide: PUBLICADOR_PRECO, useValue: publicadorFalso },
            AplicadorEvento,
            SequenciaMercado,
            AplicarEventoUseCase,
        ],
    }).compile();

    await modulo.init();
    useCase = modulo.get(AplicarEventoUseCase);
    ativos = modulo.get<Repository<Ativo>>(getRepositoryToken(Ativo));
    eventos = modulo.get<Repository<EventoMercado>>(getRepositoryToken(EventoMercado));
});

afterAll(async () => {
    await modulo.close();
});

beforeEach(async () => {
    PUBLICADOS.length = 0;
    brokerDisponivel = true;
    await eventos.clear();
    await ativos.clear();
    await ativos.save([criarAtivo("CRUS", 100), criarAtivo("GDHD", 50)]);
});

describe("AplicarEventoUseCase", () => {
    test("persiste o evento, aplica no ativo do ticker e publica o preço pós-evento", async () => {
        await useCase.executar(criarEvento(), AGORA);

        const salvos = await eventos.find();
        expect(salvos).toHaveLength(1);
        expect(salvos[0].tipo).toBe(TipoEvento.CRASH);

        const crus = await ativos.findOneByOrFail({ ticker: "CRUS" });
        expect(crus.precoReferencia).toBe(80);
        expect((await ativos.findOneByOrFail({ ticker: "GDHD" })).precoReferencia).toBe(50);

        expect(PUBLICADOS).toEqual([
            {
                ativo: "CRUS",
                preco: 80,
                origem: OrigemPreco.TICK,
                sequencia: expect.any(Number),
                timestamp: AGORA.getTime(),
            },
        ]);
    });

    test("usa a sequência global compartilhada entre os ativos", async () => {
        await useCase.executar(criarEvento({ ticker: null, tipo: TipoEvento.CRASH }), AGORA);

        const [primeiro, segundo] = PUBLICADOS;
        expect(segundo.sequencia).toBe(primeiro.sequencia + 1);
    });

    test("aplica evento global (ticker nulo) em todos os ativos ativos", async () => {
        await ativos.save(criarAtivo("GAGA", 20, { status: StatusAtivo.FALIDO }));

        await useCase.executar(criarEvento({ ticker: null, tipo: TipoEvento.DEMANDA_ALTA }), AGORA);

        expect((await ativos.findOneByOrFail({ ticker: "CRUS" })).precoReferencia).toBe(108);
        expect((await ativos.findOneByOrFail({ ticker: "GDHD" })).precoReferencia).toBe(54);
        expect((await ativos.findOneByOrFail({ ticker: "GAGA" })).precoReferencia).toBe(20);
        expect(PUBLICADOS.map((evento) => evento.ativo)).toEqual(["CRUS", "GDHD"]);
    });

    test("publica a falência para o cliente saber do GAME OVER", async () => {
        await ativos.save(criarAtivo("GAGA", 20, { podeFalir: true, mensagemGameOver: "GAME OVER" }));

        await useCase.executar(
            criarEvento({ ticker: "GAGA", tipo: TipoEvento.FALENCIA_FATAL }),
            AGORA,
        );

        const gaga = await ativos.findOneByOrFail({ ticker: "GAGA" });
        expect(gaga.status).toBe(StatusAtivo.FALIDO);
        expect(PUBLICADOS).toEqual([
            {
                ativo: "GAGA",
                preco: 20,
                origem: OrigemPreco.TICK,
                sequencia: expect.any(Number),
                timestamp: AGORA.getTime(),
                status: StatusAtivo.FALIDO,
                mensagemGameOver: "GAME OVER",
            },
        ]);
    });

    test("mantém o status fora do preço de um ativo vivo", async () => {
        await useCase.executar(criarEvento(), AGORA);

        expect(PUBLICADOS[0].status).toBeUndefined();
        expect(PUBLICADOS[0].mensagemGameOver).toBeUndefined();
    });

    test("sem broker, aplica e salva o evento sem publicar", async () => {
        brokerDisponivel = false;

        await useCase.executar(criarEvento(), AGORA);

        expect((await ativos.findOneByOrFail({ ticker: "CRUS" })).precoReferencia).toBe(80);
        expect(PUBLICADOS).toEqual([]);
    });

    test("recusa ticker inexistente sem persistir o evento", async () => {
        await expect(
            useCase.executar(criarEvento({ ticker: "ZZZZ" }), AGORA),
        ).rejects.toBeInstanceOf(NotFoundException);

        expect(await eventos.count()).toBe(0);
    });

    test("recusa falência fatal sem ticker", async () => {
        await expect(
            useCase.executar(criarEvento({ ticker: null, tipo: TipoEvento.FALENCIA_FATAL }), AGORA),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(await eventos.count()).toBe(0);
    });

    test("propaga o erro de falência fatal em ativo que não pode falir", async () => {
        await expect(
            useCase.executar(
                criarEvento({ ticker: "CRUS", tipo: TipoEvento.FALENCIA_FATAL }),
                AGORA,
            ),
        ).rejects.toThrow(/não pode falir/);

        expect((await ativos.findOneByOrFail({ ticker: "CRUS" })).status).toBe(StatusAtivo.ATIVO);
    });
});

describe("TypeOrmEventoMercadoRepository", () => {
    test("buscarVigente inclui eventos globais e ignora os encerrados", async () => {
        const repositorio = modulo.get<TypeOrmEventoMercadoRepository>(
            EVENTO_MERCADO_REPOSITORY as unknown as string,
        );

        await eventos.save([
            criarEvento({ tipo: TipoEvento.FRENZY, ticker: "CRUS" }),
            criarEvento({ tipo: TipoEvento.DEMANDA_ALTA, ticker: null }),
            criarEvento({
                tipo: TipoEvento.CRASH,
                ticker: "CRUS",
                inicio: new Date("2026-10-19T13:00:00.000Z"),
                fim: new Date("2026-10-19T13:00:30.000Z"),
            }),
            criarEvento({ tipo: TipoEvento.SHORT_SQUEEZE, ticker: "GDHD" }),
        ]);

        const vigentes = await repositorio.buscarVigente("CRUS", AGORA);

        expect(vigentes.map((evento) => evento.tipo).sort()).toEqual([
            TipoEvento.DEMANDA_ALTA,
            TipoEvento.FRENZY,
        ]);
    });
});
