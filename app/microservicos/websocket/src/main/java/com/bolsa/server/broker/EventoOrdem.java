package com.bolsa.server.broker;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/*
*
* cada etapa cria uma copia com novo evento evento repete o tipo
* da routing key  para o consumidor nao depender de header
*
* */
@JsonIgnoreProperties(ignoreUnknown = true)
public record EventoOrdem(
        String ordemId,
        String userId,
        String ativo,
        String lado,        // compra ou venda
        int quantidade,
        double preco,
        String evento,      // order
        String motivo,
        Long timestamp) {

    public EventoOrdem como(String novoEvento, String novoMotivo) {
        return new EventoOrdem(ordemId, userId, ativo, lado, quantidade, preco,
                               novoEvento, novoMotivo, System.currentTimeMillis());
    }
}