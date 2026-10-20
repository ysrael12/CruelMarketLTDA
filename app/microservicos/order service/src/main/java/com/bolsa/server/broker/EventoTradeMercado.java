package com.bolsa.server.broker;

public record EventoTradeMercado(
        String ordemCompraId,
        String ordemVendaId,
        String ativo,
        int quantidade,
        double preco,
        long timestamp) { }