import "reflect-metadata";
import { describe, expect, test } from "bun:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Ativo, Categoria, PerfilPreco, StatusAtivo } from "../domain/Ativo";
import type { AtivoRepository } from "../domain/ports/AtivoRepository";
import { ConsultarAtivoUseCase } from "./ConsultarAtivoUseCase";

function criarAtivo(ticker: string): Ativo {
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
        podeFalir: false,
        mensagemGameOver: "",
    });
}

function criarRepositorio(ativos: Ativo[]) {
    const consultas: string[] = [];
    const repositorio: AtivoRepository = {
        salvar: async () => {},
        buscarPorTicker: async (ticker) => {
            consultas.push(ticker);
            return ativos.find((ativo) => ativo.ticker === ticker) ?? null;
        },
        listar: async () => ativos,
    };

    return { repositorio, consultas };
}

describe("ConsultarAtivoUseCase", () => {
    test("normaliza o ticker e devolve o ativo", async () => {
        const crus = criarAtivo("CRUS");
        const { repositorio, consultas } = criarRepositorio([crus]);
        const useCase = new ConsultarAtivoUseCase(repositorio);

        const ativo = await useCase.executar("  crus ");

        expect(ativo).toBe(crus);
        expect(consultas).toEqual(["CRUS"]);
    });

    test("recusa ticker vazio sem consultar o repositório", async () => {
        const { repositorio, consultas } = criarRepositorio([]);
        const useCase = new ConsultarAtivoUseCase(repositorio);

        await expect(useCase.executar("   ")).rejects.toBeInstanceOf(BadRequestException);
        expect(consultas).toEqual([]);
    });

    test("responde 404 para ticker inexistente", async () => {
        const { repositorio } = criarRepositorio([criarAtivo("CRUS")]);
        const useCase = new ConsultarAtivoUseCase(repositorio);

        await expect(useCase.executar("ZZZZ")).rejects.toBeInstanceOf(NotFoundException);
    });
});
