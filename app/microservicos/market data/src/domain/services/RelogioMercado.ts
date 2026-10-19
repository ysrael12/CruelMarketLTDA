import { Ativo, PerfilPreco, StatusAtivo } from "../Ativo";
import { PoliticaBluechip } from "./PoliticaBluechip";
import { PoliticaCiclo } from "./PoliticaCiclo";
import { PoliticaFixo } from "./PoliticaFixo";
import { PoliticaPreco } from "./PoliticaPreco";
import { PoliticaRandomWalk } from "./PoliticaRandomWalk";
import type { FonteAleatoria } from "./aleatorio";

export type PoliticasPorPerfil = Record<PerfilPreco, PoliticaPreco>;

export function politicasPadrao(aleatorio: FonteAleatoria = Math.random): PoliticasPorPerfil {
    return {
        [PerfilPreco.BLUECHIP]: new PoliticaBluechip(0.001, 0.004, 0.001, aleatorio),
        [PerfilPreco.CICLO]: new PoliticaCiclo(0.02, 40, aleatorio),
        [PerfilPreco.RANDOM_WALK]: new PoliticaRandomWalk(0.06, aleatorio),
        [PerfilPreco.FIXO]: new PoliticaFixo(),
    };
}

export interface OpcoesRelogioMercado {
    politicas?: PoliticasPorPerfil;
    intervaloTickMs?: number;
}

/**
 * Relógio de mercado: a cada tick recalcula o preço de referência do ativo
 * usando a política do seu perfil. O intervalo evita que duas chamadas no
 * mesmo segundo movimentem o preço mais de uma vez.
 */
export class RelogioMercado {
    private readonly politicas: PoliticasPorPerfil;
    private readonly intervaloTickMs: number;
    private readonly ultimoTick = new Map<string, number>();

    constructor(opcoes: OpcoesRelogioMercado = {}) {
        this.politicas = opcoes.politicas ?? politicasPadrao();
        this.intervaloTickMs = opcoes.intervaloTickMs ?? 1000;
    }

    tick(ativo: Ativo, agora: Date): number {
        if (ativo.status === StatusAtivo.FALIDO) {
            return ativo.precoReferencia;
        }

        const instante = agora.getTime();
        const anterior = this.ultimoTick.get(ativo.ticker);
        if (anterior !== undefined && instante - anterior < this.intervaloTickMs) {
            return ativo.precoReferencia;
        }

        const intervalo = anterior === undefined ? this.intervaloTickMs : instante - anterior;
        this.ultimoTick.set(ativo.ticker, instante);

        const politica = this.politicas[ativo.perfil];
        ativo.atualizarPrecoReferencia(politica.proximoPreco(ativo));
        politica.avancar?.(ativo, intervalo);
        return ativo.precoReferencia;
    }
}
