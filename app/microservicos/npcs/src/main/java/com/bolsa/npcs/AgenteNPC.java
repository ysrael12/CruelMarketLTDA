package com.bolsa.npcs;

import java.util.Random;

public class AgenteNPC {

    private final String nome;
    private final PerfilNPC perfil;
    private final Random random;

    public AgenteNPC(String nome, PerfilNPC perfil, Random random) {
        this.nome = nome;
        this.perfil = perfil;
        this.random = random;
    }

    public String nome() {
        return nome;
    }

    public PerfilNPC perfil() {
        return perfil;
    }

    /** Cada perfil opera um tipo de ativo (perfil de preco definido no Market Data). */
    public boolean operaEm(AtivoInfo ativo) {
        return switch (perfil) {
            case CICLISTA -> "CICLO".equals(ativo.perfilPreco());
            case ALEATORIO -> "RANDOM_WALK".equals(ativo.perfilPreco());
            case CONSERVADOR -> "BLUECHIP".equals(ativo.perfilPreco());
        };
    }

    public Ordem decidir(AtivoInfo ativo, double preco) {
        return switch (perfil) {
            case CICLISTA -> decidirCiclista(ativo, preco);
            case ALEATORIO -> decidirAleatorio(ativo, preco);
            case CONSERVADOR -> decidirConservador(ativo, preco);
        };
    }

    private Ordem decidirCiclista(AtivoInfo ativo, double preco) {
        double posicao = (preco - ativo.piso()) / (ativo.teto() - ativo.piso());
        if (posicao <= 0.25) return criar("COMPRA", ativo, preco * 1.01, sortearQuantidade(1, 3));
        if (posicao >= 0.75) return criar("VENDA", ativo, preco * 0.99, sortearQuantidade(1, 3));
        return null;
    }

    private Ordem decidirAleatorio(AtivoInfo ativo, double preco) {
        String lado = random.nextBoolean() ? "COMPRA" : "VENDA";
        double variacao = (random.nextDouble() * 0.04) - 0.02;
        return criar(lado, ativo, preco * (1 + variacao), sortearQuantidade(1, 5));
    }

    // Age em cerca de 1 a cada 5 rodadas, com 1 unidade e preco quase igual ao atual.
    private Ordem decidirConservador(AtivoInfo ativo, double preco) {
        if (random.nextDouble() >= 0.2) return null;
        double meioDaFaixa = (ativo.piso() + ativo.teto()) / 2;
        if (preco < meioDaFaixa) return criar("COMPRA", ativo, preco * 1.005, 1);
        return criar("VENDA", ativo, preco * 0.995, 1);
    }

    private Ordem criar(String lado, AtivoInfo ativo, double preco, int quantidade) {
        double limitado = Math.max(ativo.piso(), Math.min(ativo.teto(), preco));
        double arredondado = Math.round(limitado * 100) / 100.0;
        return new Ordem(lado, ativo.ticker(), quantidade, arredondado);
    }

    private int sortearQuantidade(int minimo, int maximo) {
        return minimo + random.nextInt(maximo - minimo + 1);
    }
}
