import { Ativo, StatusAtivo } from "../Ativo";
import { EventoMercado, TipoEvento } from "../EventoMercado";

/** Impacto imediato de cada evento sobre o preço de referência. */
export const EFEITO_PRECO_POR_EVENTO: Record<TipoEvento, number> = {
    [TipoEvento.FRENZY]: 0.15,
    [TipoEvento.SHORT_SQUEEZE]: 0.3,
    [TipoEvento.CRASH]: -0.2,
    [TipoEvento.DEMANDA_ALTA]: 0.08,
    [TipoEvento.DEMANDA_BAIXA]: -0.08,
    [TipoEvento.FALENCIA_FATAL]: 0,
};

export class AplicadorEvento {
    aplicar(evento: EventoMercado, ativo: Ativo): void {
        if (evento.ticker !== null && evento.ticker !== ativo.ticker) {
            throw new Error(
                `Evento ${evento.id} é do ativo ${evento.ticker} e não pode ser aplicado em ${ativo.ticker}`,
            );
        }
        if (ativo.status === StatusAtivo.FALIDO) {
            return;
        }
        if (evento.tipo === TipoEvento.FALENCIA_FATAL) {
            ativo.falir();
            return;
        }

        const efeito = EFEITO_PRECO_POR_EVENTO[evento.tipo];
        ativo.atualizarPrecoReferencia(ativo.precoReferencia * (1 + efeito));
    }
}
