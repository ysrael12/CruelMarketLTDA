import { describe, expect, test } from "bun:test";
import { BadRequestException } from "@nestjs/common";
import type { EventoMercado } from "../domain/EventoMercado";
import type { EventoMercadoRepository } from "../domain/ports/EventoMercadoRepository";
import { ConsultarEventosUseCase, LIMITE_EVENTOS_MAXIMO, LIMITE_EVENTOS_PADRAO } from "./ConsultarEventosUseCase";

function criarRepositorio(limites: number[]): EventoMercadoRepository {
    return {
        salvar: async () => {},
        buscarVigente: async () => [],
        listar: async (limite) => {
            limites.push(limite);
            return [{ id: "1" } as EventoMercado];
        },
        buscarFuturos: async () => [],
        contarPorTipo: async () => 0,
    };
}

describe("ConsultarEventosUseCase", () => {
    test("usa o limite padrão", async () => {
        const limites: number[] = [];
        const useCase = new ConsultarEventosUseCase(criarRepositorio(limites));

        const eventos = await useCase.executar();

        expect(eventos).toHaveLength(1);
        expect(limites).toEqual([LIMITE_EVENTOS_PADRAO]);
    });

    test("limita ao máximo permitido", async () => {
        const limites: number[] = [];
        const useCase = new ConsultarEventosUseCase(criarRepositorio(limites));

        await useCase.executar(10_000);

        expect(limites).toEqual([LIMITE_EVENTOS_MAXIMO]);
    });

    test("recusa limite inválido", async () => {
        const useCase = new ConsultarEventosUseCase(criarRepositorio([]));

        await expect(useCase.executar(0)).rejects.toBeInstanceOf(BadRequestException);
        await expect(useCase.executar(Number.NaN)).rejects.toBeInstanceOf(BadRequestException);
    });
});
