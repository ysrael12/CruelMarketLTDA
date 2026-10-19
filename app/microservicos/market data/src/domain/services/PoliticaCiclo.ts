import { Ativo } from "../Ativo";
import {
    FonteAleatoria,
    PoliticaPreco,
    limitarAoIntervalo,
    variacaoAleatoria,
} from "./PoliticaPreco";

/** Ciclo: oscila dentro da faixa, com reversão para o centro proporcional à distância. */
export class PoliticaCiclo implements PoliticaPreco {
    constructor(
        private readonly reversao = 0.04,
        private readonly amplitude = 0.03,
        private readonly aleatorio: FonteAleatoria = Math.random,
    ) {}

    proximoPreco(ativo: Ativo): number {
        const centro = (ativo.piso + ativo.teto) / 2;
        const distanciaRelativa = centro === 0 ? 0 : (centro - ativo.precoReferencia) / centro;
        const ruido = variacaoAleatoria(this.aleatorio, this.amplitude);
        const passo = ativo.precoReferencia * (this.reversao * distanciaRelativa + ruido);
        return limitarAoIntervalo(ativo, ativo.precoReferencia + passo);
    }
}
