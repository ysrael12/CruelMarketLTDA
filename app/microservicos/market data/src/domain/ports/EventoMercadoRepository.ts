import { EventoMercado } from "../EventoMercado";

/** Token de injeção do adaptador de persistência de eventos de mercado. */
export const EVENTO_MERCADO_REPOSITORY = Symbol("EventoMercadoRepository");

export interface EventoMercadoRepository {
    salvar(evento: EventoMercado): Promise<void>;
    /** Eventos do ticker em vigor em `agora`, incluindo os globais (ticker nulo). */
    buscarVigente(ticker: string, agora: Date): Promise<EventoMercado[]>;
}
