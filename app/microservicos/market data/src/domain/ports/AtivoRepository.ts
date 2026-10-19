import { Ativo } from "../Ativo";

/** Token de injeção do adaptador de persistência de ativos. */
export const ATIVO_REPOSITORY = Symbol("AtivoRepository");

export interface AtivoRepository {
    salvar(ativo: Ativo): Promise<void>;
    buscarPorTicker(ticker: string): Promise<Ativo | null>;
    listar(): Promise<Ativo[]>;
}
