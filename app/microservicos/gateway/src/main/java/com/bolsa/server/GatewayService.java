package com.bolsa.server;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

@Service
public class GatewayService {

    @Autowired
    private TokenService tokenService;

    private final RabbitTemplate template;

    @Autowired
    public GatewayService(RabbitTemplate template) {
        this.template = template;
    }

    // Mantém o método original do seu colega intacto (para não quebrar o GatewayControllerAtivos):
    public String obterAtivos() {
        System.out.println("Ativos obtidos");
        return "Hello";
    }

    public ResponseEntity<?> obterAtivosAutenticado(String tokenAuth) {
        TokenService.DadosToken usuario = tokenService.verificarTokenNoService(tokenAuth);
        if (usuario == null) {
            return ResponseEntity.status(401).body("Token invalido ou expirado");
        }
        System.out.println("Ativos obtidos pelo usuario: " + usuario.username());
        return ResponseEntity.ok("Hello");
    }
}
