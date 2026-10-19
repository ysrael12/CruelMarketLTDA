import { Ativo } from "../Ativo";
import type { FonteAleatoria } from "./PoliticaPreco";
import { PoliticaPreco, limitarAoIntervalo, variacaoAleatoria } from "./PoliticaPreco";

/**
 * Ciclo: percorre uma senoide entre piso e teto. A fase fica no próprio ativo
 * (persistida), então um ciclo completo de subida e descida leva
 * `cicloSegundos` (RF04) e o movimento continua de onde parou após reinício.
 */
export class PoliticaCiclo implements PoliticaPreco {
    constructor(
        private readonly amplitude = 0.02,
        private readonly cicloSegundosPadrao = 40,
        private readonly aleatorio: FonteAleatoria = Math.random,
    ) {}

    proximoPreco(ativo: Ativo): number {
        const centro = (ativo.piso + ativo.teto) / 2;
        const meiaFaixa = (ativo.teto - ativo.piso) / 2;
        const alvo = centro + meiaFaixa * Math.sin(2 * Math.PI * this.fase(ativo));
        const ruido = alvo * variacaoAleatoria(this.aleatorio, this.amplitude);
        return limitarAoIntervalo(ativo, alvo + ruido);
    }

    avancar(ativo: Ativo, intervaloMs: number): void {
        const cicloMs = (ativo.cicloSegundos ?? this.cicloSegundosPadrao) * 1000;
        ativo.atualizarFaseCiclo(ativo.faseCiclo + intervaloMs / cicloMs);
    }

    private fase(ativo: Ativo): number {
        return ((ativo.faseCiclo % 1) + 1) % 1;
    }
}
