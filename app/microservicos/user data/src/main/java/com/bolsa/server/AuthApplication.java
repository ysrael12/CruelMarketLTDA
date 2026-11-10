package com.bolsa.server;

import org.springframework.amqp.core.FanoutExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class AuthApplication {

    public static void main(String[] args) {
        SpringApplication.run(AuthApplication.class, args);
    }

    @Bean
    public Queue usuariosRpcQueue() {
        return new Queue("usuarios.rpc.fila", true);
    }

    @Bean
    public FanoutExchange usuariosExchange() {
        return new FanoutExchange("usuarios.exchange", true, false);
    }
}
