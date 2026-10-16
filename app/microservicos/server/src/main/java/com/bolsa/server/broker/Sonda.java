package com.bolsa.server.broker;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

// TODO: remover quando os servicos passarem a consumir as filas isso aqui é so so pra testar o midware
@Component
@ConditionalOnProperty(name = "cruel.broker.sonda", havingValue = "true")
public class Sonda implements ApplicationRunner {

    private final PublicadorEventos publicador;
    private final boolean autoteste;
    private final String host = System.getenv().getOrDefault("HOSTNAME", "local");

    public Sonda(PublicadorEventos publicador, @Value("${cruel.broker.autoteste:false}") boolean autoteste) {
        this.publicador = publicador;
        this.autoteste = autoteste;
    }

    @RabbitListener(queues = Nomes.FILA_VALIDACAO)
    public void validacao(EventoOrdem e) {
        log("q.validacao", e);
    }

    @RabbitListener(queues = Nomes.FILA_ORDENS)
    public void ordens(EventoOrdem e) {
        log("q.ordens", e);
    }

    @RabbitListener(queues = "#{particoes.filasEngine()}")
    public void engine(EventoOrdem e) {
        log("q.engine.p*", e);
    }

    // consome do broker e republica
    @RabbitListener(queues = Nomes.FILA_GATEWAY)
    public void gateway(EventoOrdem e) {
        log("q.gateway", e);
        publicador.publicarParaInstancias(e);
    }

    //cada instancia recebe copia
    @RabbitListener(queues = "#{pubsubQueue.name}")
    public void pubsub(EventoOrdem e) { log("pubsub/instancia", e); }

    private void log(String onde, EventoOrdem e) {
        System.out.println("[" + host + "] [sonda " + onde + "] " + e.evento() + " ordem=" + e.ordemId() + " ativo=" + e.ativo());
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!autoteste)
            return;

        publicador.publicar(Nomes.ORDER_SUBMITTED, new EventoOrdem("teste-" + System.currentTimeMillis(), "hugo",
                "CRUEL", "COMPRA", 10, 5.5, Nomes.ORDER_SUBMITTED, null, System.currentTimeMillis()));
    }

}