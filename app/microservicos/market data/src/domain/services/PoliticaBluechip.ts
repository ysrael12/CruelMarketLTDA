import { Ativo } from "../Ativo";
import {
    FonteAleatoria,
    PoliticaPreco,
    limitarAoIntervalo,
    variacaoAleatoria,
} from "./PoliticaPreco";

/** Bluechip: baixa volatilidade e convergência lenta para o último preço negociado. */
export class PoliticaBluechip implements PoliticaPreco {
    constructor(
        private readonly amplitude = 0.005,
        private readonly convergencia = 0.05,
        private readonly aleatorio: FonteAleatoria = Math.random,
    ) {}

    proximoPreco(ativo: Ativo): number {
        const rumoAoNegociado = (ativo.ultimoPreco - ativo.precoReferencia) * this.convergencia;
        const ruido = ativo.precoReferencia * variacaoAleatoria(this.aleatorio, this.amplitude);
        return limitarAoIntervalo(ativo, ativo.precoReferencia + rumoAoNegociado + ruido);
    }
}
