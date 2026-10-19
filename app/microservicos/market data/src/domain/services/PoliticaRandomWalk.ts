import { Ativo } from "../Ativo";
import {
    FonteAleatoria,
    PoliticaPreco,
    limitarAoIntervalo,
    variacaoAleatoria,
} from "./PoliticaPreco";

/** Passeio aleatório puro: cada tick parte do preço de referência corrente. */
export class PoliticaRandomWalk implements PoliticaPreco {
    constructor(
        private readonly amplitude = 0.06,
        private readonly aleatorio: FonteAleatoria = Math.random,
    ) {}

    proximoPreco(ativo: Ativo): number {
        const variacao = variacaoAleatoria(this.aleatorio, this.amplitude);
        return limitarAoIntervalo(ativo, ativo.precoReferencia * (1 + variacao));
    }
}
