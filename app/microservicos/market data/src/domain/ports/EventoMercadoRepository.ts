import type { EventoMercado, TipoEvento } from "../EventoMercado";

/** Token de injeção do adaptador de persistência de eventos de mercado. */
export const EVENTO_MERCADO_REPOSITORY = Symbol("EventoMercadoRepository");

export interface EventoMercadoRepository {
    salvar(evento: EventoMercado): Promise<void>;
    /** Eventos do ticker em vigor em `agora`, incluindo os globais (ticker nulo). */
    buscarVigente(ticker: string, agora: Date): Promise<EventoMercado[]>;
    /** Histórico consultável (RF14), do mais recentemente anunciado para o mais antigo. */
    listar(limite: number): Promise<EventoMercado[]>;
    /** Eventos ainda não iniciados, para retomar timers após um restart (RNF10). */
    buscarFuturos(agora: Date): Promise<EventoMercado[]>;
    /** Quantos eventos de um tipo já existem — impede uma segunda falência por sessão (RF20). */
    contarPorTipo(tipo: TipoEvento): Promise<number>;
}
