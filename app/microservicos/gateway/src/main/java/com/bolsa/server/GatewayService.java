package com.bolsa.server;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Service 
public class GatewayService{
    private final RabbitTemplate template;

    public GatewayService(RabbitTemplate template) {
        this.template = template;
    }

    public String obterAtivos() {
        System.out.println("Ativos obtidos");
        return "Hello";
    }
    
}