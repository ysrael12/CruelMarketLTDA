package com.bolsa.server.broker;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

@Component
public class PublicadorEventos {

    private final RabbitTemplate rabbit;
    private final Particoes particoes;
    private final String host = System.getenv().getOrDefault("HOSTNAME", "local");

    public PublicadorEventos(RabbitTemplate rabbit, Particoes particoes) {
        this.rabbit = rabbit;
        this.particoes = particoes;
    }

    public void publicar(String tipo, EventoOrdem evento) {
        String chave = particoes.chave(tipo, evento.ativo());

        rabbit.convertAndSend(Nomes.EXCHANGE_EVENTOS, chave, evento);
        System.out.println("[" + host + "] [broker] publicado " + chave + " ordem=" + evento.ordemId());
    }

    public void publicarParaInstancias(EventoOrdem evento) {
        rabbit.convertAndSend(Nomes.EXCHANGE_PUBSUB, "", evento);
        System.out.println("[" + host + "] [pubsub] fan-out " + evento.evento() + " ordem=" + evento.ordemId());
    }
}