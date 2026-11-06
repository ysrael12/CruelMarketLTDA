package com.bolsa.server.broker;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class Particoes {
    private final int total;

    public Particoes(   @Value("${cruel.broker.particoes:4}") int total) {
        this.total = Math.max(1, total);
    }

    public int total() {
        return total;
    }

    public static String limpar(String ativo) {
        String a;

        if (ativo == null) {
            a = "";
        }
        else {
            a = ativo.toLowerCase().replaceAll("[^a-z0-9_-]", ""); // regex
        }

        if (a.isEmpty()) {
            return "desconhecido";
        }

        return a;
    }

    public int de(String ativo) {
        return Math.floorMod(limpar(ativo).hashCode(), total);
    }

    public String chave(String evento, String ativo) {
        return evento + ".p" + de(ativo) + "." + limpar(ativo);
    }

    public String filaEngine(int p) {
        return Nomes.FILA_ENGINE + p;
    }

    public String[] filasEngine() {
        String[] f = new String[total];

        for(int i = 0; i < total; i++)
            f[i] = filaEngine(i);

        return f;
    }
 }