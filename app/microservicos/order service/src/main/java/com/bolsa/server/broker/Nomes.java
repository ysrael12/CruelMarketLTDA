package com.bolsa.server.broker;

public final class Nomes {

    static final String EXCHANGE_EVENTOS = "cruel.eventos";
    static final String EXCHANGE_PUBSUB = "cruel.pubsub";
    static final String EXCHANGE_DLX = "cruel.dlx";
    static final String FILA_DLQ = "cruel.dlq";
    static final String CHAVE_DLQ = "dead";

    // fila dos servicos
    static final String FILA_VALIDACAO = "q.validacao";
    static final String FILA_ENGINE = "q.engine.p";
    static final String FILA_GATEWAY = "q.gateway";
    static final String FILA_ORDENS = "q.ordens";

    // eventos
    static final String ORDER_SUBMITTED = "order.submitted";
    static final String ORDER_VALIDATED = "order.validated";
    static final String ORDER_REJECTED = "order.rejected";
    static final String ORDER_ACCEPTED = "order.accepted";
    static final String PRICE_UPDATED = "price.updated";
    static final String TRADE_EXECUTED = "trade.executed";



}