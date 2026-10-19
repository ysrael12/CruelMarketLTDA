/** Linha do catálogo de ativos usada por `GET /ativos`. */
export interface ResumoAtivo {
    ticker: string;
    /** Preço do último negócio; sem negócio, o preço de referência. */
    ultimoPreco: number;
    /** Variação do preço exibido em relação ao preço de referência, em %. */
    variacaoPercentual: number;
    /** Soma das quantidades já negociadas. */
    volume: number;
}
