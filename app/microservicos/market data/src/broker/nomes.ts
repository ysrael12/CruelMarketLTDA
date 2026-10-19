/** Nomes de exchanges, filas e eventos — espelham `Nomes.java` do serviço de ordens. */
export const EXCHANGE_EVENTOS = "cruel.eventos";
export const EXCHANGE_DLX = "cruel.dlx";
export const FILA_DLQ = "cruel.dlq";
export const CHAVE_DLQ = "dead";

export const FILA_MERCADO = process.env.FILA_MERCADO ?? "q.mercado";

export const PRICE_UPDATED = "price.updated";
export const TRADE_EXECUTED = "trade.executed";
