import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Test, type TestingModule } from "@nestjs/testing";
import { TypeOrmModule, getRepositoryToken } from "@nestjs/typeorm";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repository } from "typeorm";
import { Ativo, Categoria, PerfilPreco, StatusAtivo } from "../domain/Ativo";
import type { AtivoConfig } from "./ativos.config";
import { lerAtivosConfig } from "./ativos.config";
import { ATIVOS_CONFIG, SeedService } from "./seed.service";

const CONFIGS: AtivoConfig[] = [
    {
        ticker: "CRUS",
        nome: "Cruelty Squad",
        categoria: Categoria.ACAO,
        perfil: PerfilPreco.BLUECHIP,
        piso: 90,
        teto: 150,
        precoReferencia: 110,
        podeFalir: false,
    },
    {
        ticker: "GAGA",
        nome: "GamesGames",
        categoria: Categoria.ACAO,
        perfil: PerfilPreco.RANDOM_WALK,
        piso: 8,
        teto: 60,
        precoReferencia: 30,
        podeFalir: true,
        mensagemGameOver: "Game over, literalmente.",
    },
];

let modulo: TestingModule;
let seed: SeedService;
let ativos: Repository<Ativo>;

beforeAll(async () => {
    modulo = await Test.createTestingModule({
        imports: [
            TypeOrmModule.forRoot({
                type: "better-sqlite3",
                database: ":memory:",
                synchronize: true,
                entities: [Ativo],
            }),
            TypeOrmModule.forFeature([Ativo]),
        ],
        providers: [SeedService, { provide: ATIVOS_CONFIG, useValue: CONFIGS }],
    }).compile();

    await modulo.init();
    seed = modulo.get(SeedService);
    ativos = modulo.get<Repository<Ativo>>(getRepositoryToken(Ativo));
});

afterAll(async () => {
    await modulo.close();
});

test("semeia os ativos da configuracao no boot", async () => {
    expect(await ativos.count()).toBe(2);

    const gaga = await ativos.findOneByOrFail({ ticker: "GAGA" });
    expect(gaga.status).toBe(StatusAtivo.ATIVO);
    expect(gaga.ultimoPreco).toBeNull();
    expect(gaga.precoExibido()).toBe(30);
});

test("nao duplica ativos ja existentes", async () => {
    expect(await seed.semear(CONFIGS)).toEqual([]);
    expect(await ativos.count()).toBe(2);
});

test("persiste o ultimo preco negociado", async () => {
    const gaga = await ativos.findOneByOrFail({ ticker: "GAGA" });
    gaga.atualizarUltimoPreco(42);
    await ativos.save(gaga);

    const relido = await ativos.findOneByOrFail({ ticker: "GAGA" });
    expect(relido.ultimoPreco).toBe(42);
    expect(relido.precoExibido()).toBe(42);
});

describe("catalogo em arquivo", () => {
    test("carrega o catalogo da planilha de P1", () => {
        const config = lerAtivosConfig();

        expect(config.length).toBe(10);
        expect(config.find((ativo) => ativo.ticker === "CRUS")?.perfil).toBe(PerfilPreco.BLUECHIP);
        expect(config.find((ativo) => ativo.ticker === "GAGA")?.podeFalir).toBe(true);
        expect(
            config.filter((ativo) => ativo.categoria === Categoria.PEIXE).map((ativo) => ativo.ticker),
        ).toEqual(["CIV", "SLRP", "BRNY"]);
        expect(
            config.find((ativo) => ativo.categoria === Categoria.PECA)?.ticker,
        ).toBe("ORGN");
        expect(config.find((ativo) => ativo.ticker === "GDHD")?.cicloSegundos).toBe(60);
    });

    test("rejeita ativo que pode falir sem mensagem de GAME OVER", () => {
        const diretorio = mkdtempSync(join(tmpdir(), "market-data-"));
        const arquivo = join(diretorio, "ativos.json");
        writeFileSync(
            arquivo,
            JSON.stringify({
                ativos: [
                    {
                        ticker: "TEST3",
                        nome: "Teste",
                        categoria: "ACAO",
                        perfil: "FIXO",
                        piso: 1,
                        teto: 2,
                        precoReferencia: 1.5,
                        podeFalir: true,
                    },
                ],
            }),
        );

        try {
            expect(() => lerAtivosConfig(arquivo)).toThrow(/mensagemGameOver/);
        } finally {
            rmSync(diretorio, { recursive: true, force: true });
        }
    });
});
