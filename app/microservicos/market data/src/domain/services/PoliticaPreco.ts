import { Ativo } from "../Ativo";

/** Fonte de aleatoriedade injetável para deixar as políticas determinísticas em teste. */
export type FonteAleatoria = () => number;

export interface PoliticaPreco {
    proximoPreco(ativo: Ativo): number;
}

/** Fração aleatória uniforme em [-amplitude/2, +amplitude/2]. */
export function variacaoAleatoria(aleatorio: FonteAleatoria, amplitude: number): number {
    return (aleatorio() - 0.5) * amplitude;
}

export function arredondarPreco(valor: number): number {
    return Math.round(valor * 100) / 100;
}

/** Mantém o preço dentro da faixa [piso, teto] do ativo. */
export function limitarAoIntervalo(ativo: Ativo, preco: number): number {
    return arredondarPreco(Math.min(ativo.teto, Math.max(ativo.piso, preco)));
}