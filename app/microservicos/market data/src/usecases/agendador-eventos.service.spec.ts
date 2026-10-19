import "reflect-metadata";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Test, type TestingModule } from "@nestjs/testing";
import { TypeOrmModule, getRepositoryToken } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { TypeOrmAtivoRepository } from "../database/ativo.repository";
import { TypeOrmEventoMercadoRepository } from "../database/evento-mercado.repository";
import { Ativo, Categoria, PerfilPreco, StatusAtivo } from "../domain/Ativo";
import { EventoMercado, TipoEvento } from "../domain/EventoMercado";
import { GeradorEventos } from "../domain/services/GeradorEventos";
import { AgendadorEventos } from "./agendador-eventos.service";
import type { AplicarEventoUseCase } from "./AplicarEventoUseCase";

function criarAtivo(ticker: string, podeFalir = false, status = StatusAtivo.ATIVO): Ativo {
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
        status,
        faseCiclo: 0,
        cicloSegundos: null,
        podeFalir,
        mensagemGameOver: podeFalir ? "GAME OVER" : "",
    });
}

let modulo: TestingModule;
let ativos: Repository<Ativo>;
let eventos: Repository<EventoMercado>;
let repoAtivos: TypeOrmAtivoRepository;
let repoEventos: TypeOrmEventoMercadoRepository;
let aplicados: EventoMercado[];
let agendador: AgendadorEventos | undefined;

function geradorRapido(falenciaMs = 60_000): GeradorEventos {
    return new GeradorEventos({
        aleatorio: () => 0,
        intervaloMinMs: 5,
        intervaloMaxMs: 5,
        briefingMs: 1,
        duracaoMinMs: 5,
        duracaoMaxMs: 5,
        falenciaMinMs: falenciaMs,
        falenciaMaxMs: falenciaMs,
    });
}

async function aguardar(condicao: () => boolean, limiteMs = 1000): Promise<void> {
    const inicio = Date.now();
    while (!condicao() && Date.now() - inicio < limiteMs) {
        await new Promise((resolver) => setTimeout(resolver, 5));
    }
}

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
        providers: [TypeOrmAtivoRepository, TypeOrmEventoMercadoRepository],
    }).compile();

    await modulo.init();
    ativos = modulo.get<Repository<Ativo>>(getRepositoryToken(Ativo));
    eventos = modulo.get<Repository<EventoMercado>>(getRepositoryToken(EventoMercado));
    repoAtivos = modulo.get(TypeOrmAtivoRepository);
    repoEventos = modulo.get(TypeOrmEventoMercadoRepository);
});

afterAll(async () => {
    await modulo.close();
});

beforeEach(async () => {
    agendador?.onApplicationShutdown();
    agendador = undefined;
    aplicados = [];
    await eventos.clear();
    await ativos.clear();
    await ativos.save([criarAtivo("CRUS"), criarAtivo("GAGA", true)]);
});

function iniciar(falenciaMs = 60_000): AgendadorEventos {
    agendador = new AgendadorEventos(
        repoAtivos,
        repoEventos,
        { executar: async (evento: EventoMercado) => void aplicados.push(evento) } as unknown as AplicarEventoUseCase,
        geradorRapido(falenciaMs),
    );
    return agendador;
}

describe("AgendadorEventos", () => {
    test("grava o anúncio e aplica o evento regular depois do briefing", async () => {
        await iniciar().iniciar();

        await aguardar(() => aplicados.length > 0);

        expect(aplicados.length).toBeGreaterThan(0);
        const aplicado = aplicados[0];
        expect(aplicado.ticker).toBe("CRUS");
        expect(await eventos.findOneByOrFail({ id: aplicado.id })).toBeDefined();
    });

    test("persiste a falência agendada antes de disparar (RNF10)", async () => {
        await iniciar().iniciar();

        const falencia = await eventos.findOneByOrFail({ tipo: TipoEvento.FALENCIA_FATAL });
        expect(falencia.ticker).toBe("GAGA");
        expect(falencia.inicio.getTime()).toBeGreaterThan(Date.now());
        expect(aplicados.some((evento) => evento.tipo === TipoEvento.FALENCIA_FATAL)).toBe(false);
    });

    test("não agenda uma segunda falência quando já existe uma persistida", async () => {
        await eventos.save(
            Object.assign(new EventoMercado(), {
                tipo: TipoEvento.FALENCIA_FATAL,
                ticker: "GAGA",
                anunciadoEm: new Date(),
                inicio: new Date(Date.now() + 60_000),
                fim: new Date(Date.now() + 60_000),
            }),
        );

        await iniciar().iniciar();

        expect(await eventos.countBy({ tipo: TipoEvento.FALENCIA_FATAL })).toBe(1);
    });

    test("retoma evento com início no futuro e o aplica (RNF10)", async () => {
        const futuro = Object.assign(new EventoMercado(), {
            tipo: TipoEvento.CRASH,
            ticker: "CRUS",
            anunciadoEm: new Date(),
            inicio: new Date(Date.now() + 20),
            fim: new Date(Date.now() + 5_000),
        });
        await eventos.save(futuro);

        await iniciar().iniciar();
        await aguardar(() => aplicados.some((evento) => evento.tipo === TipoEvento.CRASH));

        expect(aplicados.map((evento) => evento.tipo)).toContain(TipoEvento.CRASH);
    });

    test("não agenda nada quando todos os ativos faliram", async () => {
        await ativos.save(criarAtivo("CRUS", false, StatusAtivo.FALIDO));
        await ativos.save(criarAtivo("GAGA", true, StatusAtivo.FALIDO));

        await iniciar().iniciar();
        await new Promise((resolver) => setTimeout(resolver, 30));

        expect(await eventos.count()).toBe(0);
        expect(aplicados).toEqual([]);
    });

    test("para de agendar depois do shutdown", async () => {
        const agendando = iniciar();
        await agendando.iniciar();
        await aguardar(() => aplicados.length > 0);

        agendando.onApplicationShutdown();
        const aplicadosAoParar = aplicados.length;
        await new Promise((resolver) => setTimeout(resolver, 30));

        expect(aplicados.length).toBe(aplicadosAoParar);
    });
});
