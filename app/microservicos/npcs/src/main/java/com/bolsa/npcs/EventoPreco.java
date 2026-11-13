package com.bolsa.npcs;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Evento price.updated publicado pelo Market Data: {"ativo","preco","origem","sequencia","timestamp"}. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record EventoPreco(String ativo, double preco, String origem, long sequencia, long timestamp) { }
