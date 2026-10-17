package com.bolsa.server;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class Auth {

    // Tabela de login
    private static final Map<String, String> JOGADORES = new ConcurrentHashMap<>(Map.of(
        "jogador1", "senha123",
        "jogador2", "abc456"
    ));

    // Validação
    public static boolean loginValido(String jogador, String senha) {
        if (jogador == null || senha == null) {
            return false;
        }
        
        String senhaCorreta = JOGADORES.get(jogador);
        if (senhaCorreta == null) {
            return false;
        }

        return MessageDigest.isEqual(
            senha.getBytes(StandardCharsets.UTF_8),
            senhaCorreta.getBytes(StandardCharsets.UTF_8)
        );
    }

    // Cadastrar novos jogadores
    public static void cadastrar(String novoJogador, String novaSenha) {
        if (novoJogador != null && !novoJogador.isBlank() && novaSenha != null) {
            JOGADORES.put(novoJogador, novaSenha);
        }
    }
}
