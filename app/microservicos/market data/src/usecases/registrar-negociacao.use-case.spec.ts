import "reflect-metadata";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { TypeOrmModule, getRepositoryToken } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import type { EventoTrade } from "../broker/EventoTrade";
import { TypeOrmAtivoRepository } from "../database/ativo.repository";
import { TypeOrmNegociacaoRepository } from "../database/negociacao.repository";
import { Ativo, Categoria, PerfilPreco, StatusAtivo } from "../domain/Ativo";
import { Negociacao } from "../domain/Negociacao";
import { ATIVO_REPOSITORY } from "../domain/ports/AtivoRepository";
import { NEGOCIACAO_REPOSITORY } from "../domain/ports/NegociacaoRepository";
import { OrigemPreco, PUBLICADOR_PRECO } from "../domain/ports/PublicadorPreco";
import type { EventoPreco } from "../domain/ports/PublicadorPreco";
import { AtualizadorUltimoPreco } from "../domain/services/AtualizadorUltimoPreco";
import { SequenciaMercado } from "../domain/services/SequenciaMercado";
import { RegistrarNegociacaoUseCase } from "./RegistrarNegociacaoUseCase";

const PUBLICADOS: EventoPreco[] = [];

const publicadorFalso = {
    publicar: async (evento: EventoPreco): Promise<void> => {
        PUBLICADOS.push(evento);
    },
    disponivel: () => true,
};

function criarAtivo(alteracoes: Partial<Ativo> = {}): Ativo {
    const ativo = new Ativo();
    ativo.ticker = "CRUS";
    ativo.nome = "Cruelty Squad";
    ativo.descricao = "";
    ativo.categoria = Categoria.ACAO;
    ativo.perfil = PerfilPreco.BLUECHIP;
    ativo.piso = 90;
    ativo.teto = 150;
    ativo.precoReferencia = 110;
    ativo.ultimoPreco = null;
    ativo.status = StatusAtivo.ATIVO;
    ativo.faseCiclo = 0;
    ativo.cicloSegundos = null;
    ativo.podeFalir = false;
    ativo.mensagemGameOver = "";
    return Object.assign(ativo, alteracoes);
}

function criarEvento(alteracoes: Partial<EventoTrade> = {}): EventoTrade {
    return {
        ordemCompraId: "compra-1",
        ordemVendaId: "venda-1",
        ativo: "crus",
        quantidade: 10,
        preco: 120,
        timestamp: Date.parse("2026-10-19T14:00:00.000Z"),
        ...alteracoes,
    };
}

let modulo: TestingModule;
let useCase: RegistrarNegociacaoUseCase;
let ativos: Repository<Ativo>;
let negociacoes: Repository<Negociacao>;

beforeAll(async () => {
    modulo = await Test.createTestingModule({
        imports: [
            TypeOrmModule.forRoot({
                type: "better-sqlite3",
                database: ":memory:",
                synchronize: true,
                entities: [Ativo, Negociacao],
            }),
            TypeOrmModule.forFeature([Ativo, Negociacao]),
        ],
        providers: [
            TypeOrmAtivoRepository,
            TypeOrmNegociacaoRepository,
            { provide: ATIVO_REPOSITORY, useExisting: TypeOrmAtivoRepository },
            { provide: NEGOCIACAO_REPOSITORY, useExisting: TypeOrmNegociacaoRepository },
            { provide: PUBLICADOR_PRECO, useValue: publicadorFalso },
            AtualizadorUltimoPreco,
            SequenciaMercado,
            RegistrarNegociacaoUseCase,
        ],
    }).compile();

    await modulo.init();
    useCase = modulo.get(RegistrarNegociacaoUseCase);
    ativos = modulo.get<Repository<Ativo>>(getRepositoryToken(Ativo));
    negociacoes = modulo.get<Repository<Negociacao>>(getRepositoryToken(Negociacao));
});

afterAll(async () => {
    await modulo.close();
});

beforeEach(async () => {
    PUBLICADOS.length = 0;
    await negociacoes.clear();
    await ativos.clear();
    await ativos.save(criarAtivo());
});

describe("RegistrarNegociacaoUseCase", () => {
    test("registra a negociação, atualiza o último preço e publica o novo preço", async () => {
        const evento = criarEvento();
        const negociacao = await useCase.executar(evento);

        expect(negociacao).not.toBeNull();

        const [salva] = await negociacoes.find();
        expect(salva.ticker).toBe("CRUS");
        expect(salva.ordemCompraId).toBe("compra-1");
        expect(salva.ordemVendaId).toBe("venda-1");
        expect(salva.quantidade).toBe(10);
        expect(salva.preco).toBe(120);
        expect(salva.executadaEm.toISOString()).toBe("2026-10-19T14:00:00.000Z");
        expect(salva.sequencia).toBeGreaterThan(0);

        const atualizado = await ativos.findOneByOrFail({ ticker: "CRUS" });
        expect(atualizado.ultimoPreco).toBe(120);

        expect(PUBLICADOS).toHaveLength(1);
        expect(PUBLICADOS[0]).toEqual({
            ativo: "CRUS",
            preco: 120,
            origem: OrigemPreco.NEGOCIO,
            sequencia: salva.sequencia,
            timestamp: evento.timestamp,
        });
    });

    test("incrementa a sequência global a cada negociação", async () => {
        const primeira = await useCase.executar(criarEvento());
        const segunda = await useCase.executar(criarEvento({ preco: 125 }));

        expect(segunda!.sequencia).toBe(primeira!.sequencia + 1);
        expect(PUBLICADOS.map((evento) => evento.sequencia)).toEqual([
            primeira!.sequencia,
            segunda!.sequencia,
        ]);
    });

    test("guarda o preço real e exibe o preço limitado à faixa do ativo", async () => {
        await useCase.executar(criarEvento({ preco: 500 }));

        const salvos = await negociacoes.find();
        expect(salvos[0].preco).toBe(500);
        expect(PUBLICADOS[0].preco).toBe(150);
        expect((await ativos.findOneByOrFail({ ticker: "CRUS" })).ultimoPreco).toBe(150);
    });

    test("descarta a execução de ativo falido", async () => {
        await ativos.save(criarAtivo({ ticker: "GAGA", status: StatusAtivo.FALIDO }));

        const resultado = await useCase.executar(criarEvento({ ativo: "GAGA" }));

        expect(resultado).toBeNull();
        expect(await negociacoes.count()).toBe(0);
        expect(PUBLICADOS).toHaveLength(0);
    });

    test("recusa ativo inexistente", async () => {
        await expect(useCase.executar(criarEvento({ ativo: "ZZZZ" }))).rejects.toBeInstanceOf(
            NotFoundException,
        );
        expect(await negociacoes.count()).toBe(0);
    });

    test("recusa payload inválido", async () => {
        const invalidos: Partial<EventoTrade>[] = [
            { ativo: "  " },
            { ordemCompraId: "" },
            { ordemVendaId: "" },
            { quantidade: 0 },
            { quantidade: 1.5 },
            { preco: -1 },
            { timestamp: Number.NaN },
        ];

        for (const invalido of invalidos) {
            await expect(useCase.executar(criarEvento(invalido))).rejects.toBeInstanceOf(
                BadRequestException,
            );
        }
        expect(await negociacoes.count()).toBe(0);
        expect(PUBLICADOS).toHaveLength(0);
    });
});
