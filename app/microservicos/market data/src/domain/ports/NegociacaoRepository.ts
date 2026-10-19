import { Negociacao } from "../Negociacao";

/** Token de injeção do adaptador de persistência de negociações. */
export const NEGOCIACAO_REPOSITORY = Symbol("NegociacaoRepository");

export interface NegociacaoRepository {
    salvar(negociacao: Negociacao): Promise<void>;
    listarPorTicker(ticker: string, limite: number): Promise<Negociacao[]>;
    /** Volume total (soma das quantidades) por ticker; ativos sem negócio ficam de fora. */
    volumePorTicker(): Promise<Map<string, number>>;
}
