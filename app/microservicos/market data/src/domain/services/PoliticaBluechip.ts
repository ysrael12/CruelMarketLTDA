import { Ativo } from "../Ativo";
import type { FonteAleatoria } from "./PoliticaPreco";
import {
    PoliticaPreco,
    limitarAoIntervalo,
} from "./PoliticaPreco";

/** Bluechip: deriva de alta suave, baixa volatilidade e nenhuma queda. */
export class PoliticaBluechip implements PoliticaPreco {
    constructor(
        private readonly deriva = 0.001,
        private readonly amplitude = 0.004,
        private readonly quedaMaxima = 0.001,
        private readonly aleatorio: FonteAleatoria = Math.random,
    ) {}

    proximoPreco(ativo: Ativo): number {
        const ruido = this.aleatorio() * (this.amplitude + this.quedaMaxima) - this.quedaMaxima;
        const passo = ativo.precoReferencia * (this.deriva + ruido);
        return limitarAoIntervalo(ativo, ativo.precoReferencia + passo);
    }
}
