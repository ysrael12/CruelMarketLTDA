package com.bolsa.server;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Service 
public class GatewayService{

    @Autowired
    private TokenService tokenService;

    @Autowired
    private final RabbitTemplate template;

    public GatewayService(RabbitTemplate template) {
        this.template = template;
    }

    public ResponseEntity<?> seuMetodoExistente(String tokenAuth, ...) {
        TokenService.DadosToken usuario = tokenService.verificarTokenNoService(tokenAuth);
        if (usuario == null) {
            return ResponseEntity.status(401).body("Token invalido ou expirado");
        }

    public String obterAtivos() {
        System.out.println("Ativos obtidos");
        return "Hello";
    }
    
}
