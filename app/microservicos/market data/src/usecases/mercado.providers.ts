import type { Provider } from "@nestjs/common";
import { AplicadorEvento } from "../domain/services/AplicadorEvento";
import { AtualizadorUltimoPreco } from "../domain/services/AtualizadorUltimoPreco";
import { GeradorEventos } from "../domain/services/GeradorEventos";
import { RelogioMercado, politicasPadrao } from "../domain/services/RelogioMercado";
import { SequenciaMercado } from "../domain/services/SequenciaMercado";
import { criarGeradorSemeado } from "../domain/services/aleatorio";
import type { FonteAleatoria } from "../domain/services/aleatorio";

/** Fonte aleatória compartilhada por preços e eventos (RNF05). */
export const FONTE_ALEATORIA = Symbol("FonteAleatoria");

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

export function criarFonteAleatoria(): FonteAleatoria {
    const semente = process.env.SEED_MERCADO;
    return semente && semente.trim() !== ""
        ? criarGeradorSemeado(lerNumeroDoAmbiente("SEED_MERCADO", 0))
        : Math.random;
}

export function criarRelogioMercado(aleatorio: FonteAleatoria): RelogioMercado {
    return new RelogioMercado({
        politicas: politicasPadrao(aleatorio),
        intervaloTickMs: lerNumeroDoAmbiente("TICK_MS", TICK_MS_PADRAO),
    });
}

export function criarGeradorEventos(aleatorio: FonteAleatoria): GeradorEventos {
    const opcoes: ConstructorParameters<typeof GeradorEventos>[0] = { aleatorio };

    // Atalho para demo/teste: força o intervalo entre eventos regulares.
    const intervalo = process.env.EVENTOS_INTERVALO_MS;
    if (intervalo !== undefined && intervalo.trim() !== "") {
        const intervaloMs = lerNumeroDoAmbiente("EVENTOS_INTERVALO_MS", 45_000);
        opcoes.intervaloMinMs = intervaloMs;
        opcoes.intervaloMaxMs = intervaloMs;
    }

    const briefing = process.env.EVENTOS_BRIEFING_MS;
    if (briefing !== undefined && briefing.trim() !== "") {
        opcoes.briefingMs = lerNumeroDoAmbiente("EVENTOS_BRIEFING_MS", 5_000);
    }

    return new GeradorEventos(opcoes);
}

/** Serviços de domínio do mercado, sem dependência de infraestrutura. */
export const provedoresMercado: Provider[] = [
    AplicadorEvento,
    AtualizadorUltimoPreco,
    SequenciaMercado,
    { provide: FONTE_ALEATORIA, useFactory: criarFonteAleatoria },
    {
        provide: RelogioMercado,
        useFactory: criarRelogioMercado,
        inject: [FONTE_ALEATORIA],
    },
    {
        provide: GeradorEventos,
        useFactory: criarGeradorEventos,
        inject: [FONTE_ALEATORIA],
    },
];
