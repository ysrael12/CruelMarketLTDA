/** Fonte de aleatoriedade injetável: determinística quando semeada. */
export type FonteAleatoria = () => number;

/**
 * Mulberry32: PRNG pequeno e determinístico, usado com `SEED_MERCADO` para
 * reproduzir preços em testes de concorrência e carga (RNF05).
 */
export function criarGeradorSemeado(seed: number): FonteAleatoria {
    let estado = seed >>> 0;

    return () => {
        estado = (estado + 0x6d2b79f5) >>> 0;
        let valor = estado;
        valor = Math.imul(valor ^ (valor >>> 15), valor | 1);
        valor ^= valor + Math.imul(valor ^ (valor >>> 7), valor | 61);
        return ((valor ^ (valor >>> 14)) >>> 0) / 4294967296;
    };
}
