package com.bolsa.npcs;

import java.util.Locale;

/** Ordem decidida por um NPC, ainda sem o nome de quem envia. */
public record Ordem(String lado, String ticker, int quantidade, double preco) {

    /** Texto que o motor de ordens espera: "usuario:LADO TICKER QUANTIDADE PRECO" (ponto nos decimais). */
    public String paraMensagem(String usuario) {
        return usuario + ":" + lado + " " + ticker + " " + quantidade + " "
                + String.format(Locale.ROOT, "%.2f", preco);
    }
}
