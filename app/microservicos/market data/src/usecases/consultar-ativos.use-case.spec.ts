import "reflect-metadata";
import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { Test, type TestingModule } from "@nestjs/testing";
import { TypeOrmModule, getRepositoryToken } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { TypeOrmAtivoRepository } from "../database/ativo.repository";
import { TypeOrmNegociacaoRepository } from "../database/negociacao.repository";
import { Ativo, Categoria, PerfilPreco, StatusAtivo } from "../domain/Ativo";
import { Negociacao } from "../domain/Negociacao";
import { ATIVO_REPOSITORY } from "../domain/ports/AtivoRepository";
import { NEGOCIACAO_REPOSITORY } from "../domain/ports/NegociacaoRepository";
import { ConsultarAtivosUseCase } from "./ConsultarAtivosUseCase";

function criarAtivo(
    ticker: string,
    precoReferencia: number,
    ultimoPreco: number | null,
    status: StatusAtivo = StatusAtivo.ATIVO,
): Ativo {
    const ativo = new Ativo();
    ativo.ticker = ticker;
    ativo.nome = ticker;
    ativo.descricao = "";
    ativo.categoria = Categoria.ACAO;
    ativo.perfil = PerfilPreco.FIXO;
    ativo.piso = 1;
    ativo.teto = 10_000;
    ativo.precoReferencia = precoReferencia;
    ativo.ultimoPreco = ultimoPreco;
    ativo.status = status;
    ativo.faseCiclo = 0;
    ativo.cicloSegundos = null;
    ativo.podeFalir = false;
    ativo.mensagemGameOver = "";
    return ativo;
}

function criarNegociacao(ativo: Ativo, quantidade: number, preco: number, sequencia: number): Negociacao {
    const negociacao = new Negociacao();
    negociacao.ticker = ativo.ticker;
    negociacao.ordemCompraId = `compra-${ativo.ticker}-${sequencia}`;
    negociacao.ordemVendaId = `venda-${ativo.ticker}-${sequencia}`;
    negociacao.quantidade = quantidade;
    negociacao.preco = preco;
    negociacao.executadaEm = new Date(Date.parse("2026-10-19T14:00:00.000Z") + sequencia * 1000);
    negociacao.sequencia = sequencia;
    return negociacao;
}

let modulo: TestingModule;
let useCase: ConsultarAtivosUseCase;
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
            ConsultarAtivosUseCase,
        ],
    }).compile();

    await modulo.init();
    useCase = modulo.get(ConsultarAtivosUseCase);
    ativos = modulo.get<Repository<Ativo>>(getRepositoryToken(Ativo));
    negociacoes = modulo.get<Repository<Negociacao>>(getRepositoryToken(Negociacao));
});

afterAll(async () => {
    await modulo.close();
});

beforeEach(async () => {
    await negociacoes.clear();
    await ativos.clear();
});

test("lista o catálogo em ordem alfabética com preço, variação e volume", async () => {
    const gdhd = criarAtivo("GDHD", 50, 55);
    const crus = criarAtivo("CRUS", 100, 120);
    await ativos.save([gdhd, crus]);
    await negociacoes.save([
        criarNegociacao(crus, 10, 120, 1),
        criarNegociacao(crus, 5, 118, 2),
        criarNegociacao(gdhd, 7, 55, 3),
    ]);

    const catalogo = await useCase.executar();

    expect(catalogo).toEqual([
        { ticker: "CRUS", ultimoPreco: 120, variacaoPercentual: 20, volume: 15 },
        { ticker: "GDHD", ultimoPreco: 55, variacaoPercentual: 10, volume: 7 },
    ]);
});

test("sem negócio, usa o preço de referência, variação zero e volume zero", async () => {
    await ativos.save(criarAtivo("AOI", 42.5, null));

    const [resumo] = await useCase.executar();

    expect(resumo).toEqual({
        ticker: "AOI",
        ultimoPreco: 42.5,
        variacaoPercentual: 0,
        volume: 0,
    });
});

test("arredonda a variação percentual em duas casas", async () => {
    await ativos.save(criarAtivo("CIV", 3, 3.01));

    const [resumo] = await useCase.executar();

    expect(resumo.variacaoPercentual).toBe(0.33);
});

test("mantém ativos falidos no catálogo", async () => {
    await ativos.save(criarAtivo("GAGA", 20, 20, StatusAtivo.FALIDO));

    const [resumo] = await useCase.executar();

    expect(resumo.ticker).toBe("GAGA");
    expect(resumo.volume).toBe(0);
});

test("devolve lista vazia quando não há ativos", async () => {
    expect(await useCase.executar()).toEqual([]);
});
