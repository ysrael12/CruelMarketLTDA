import type { Provider } from "@nestjs/common";
import { AplicadorEvento } from "../domain/services/AplicadorEvento";
import { AtualizadorUltimoPreco } from "../domain/services/AtualizadorUltimoPreco";
import { RelogioMercado, politicasPadrao } from "../domain/services/RelogioMercado";
import { criarGeradorSemeado } from "../domain/services/aleatorio";

const TICK_MS_PADRAO = 1000;

function lerNumeroDoAmbiente(nome: string, padrao: number): number {
    const valor = process.env[nome];
    if (valor === undefined || valor.trim() === "") {
        return padrao;
    }

    const numero = Number(valor);
    if (!Number.isFinite(numero)) {
        throw new Error(`${nome} deve ser numérico, recebido: ${valor}`);
    }
    return numero;
}

export function criarRelogioMercado(): RelogioMercado {
    const semente = process.env.SEED_MERCADO;
    const aleatorio = semente && semente.trim() !== ""
        ? criarGeradorSemeado(lerNumeroDoAmbiente("SEED_MERCADO", 0))
        : Math.random;

    return new RelogioMercado({
        politicas: politicasPadrao(aleatorio),
        intervaloTickMs: lerNumeroDoAmbiente("TICK_MS", TICK_MS_PADRAO),
    });
}

/** Serviços de domínio do mercado, sem dependência de infraestrutura. */
export const provedoresMercado: Provider[] = [
    AplicadorEvento,
    AtualizadorUltimoPreco,
    { provide: RelogioMercado, useFactory: criarRelogioMercado },
];
