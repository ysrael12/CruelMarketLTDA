/**
 * Payload de `trade.executed` (exchange `cruel.eventos`, routing key `evento.p{N}.{ativo}`).
 *
 * Ainda não existe produtor no repositório: o serviço de ordens/matching precisa publicar
 * os dois lados da execução (compra e venda) para que a negociação seja persistida.
 */
export interface EventoTrade {
    ordemCompraId: string;
    ordemVendaId: string;
    /** Ticker do ativo negociado. */
    ativo: string;
    quantidade: number;
    preco: number;
    /** Momento da execução em epoch de milissegundos. */
    timestamp: number;
}
