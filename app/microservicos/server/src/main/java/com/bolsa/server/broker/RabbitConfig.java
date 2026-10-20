package com.bolsa.server.broker;

import java.util.ArrayList;
import java.util.List;

import org.springframework.amqp.core.AnonymousQueue;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Declarable;
import org.springframework.amqp.core.Declarables;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.FanoutExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {

    @Bean
    TopicExchange  eventosExchange() {
        return new TopicExchange(Nomes.EXCHANGE_EVENTOS, true, false);
    }

    @Bean
    FanoutExchange pubsubExchange() {
        return new FanoutExchange(Nomes.EXCHANGE_PUBSUB, true, false);
    }

    @Bean
    DirectExchange dlxExchange() {
        return new DirectExchange(Nomes.EXCHANGE_DLX, true, false);
    }

    @Bean
    Queue dlq() {
        return QueueBuilder.durable(Nomes.FILA_DLQ)
                .build();
    }

    @Bean
    Binding dlqBinding() {
        return BindingBuilder.bind(dlq())
                .to(dlxExchange())
                .with(Nomes.CHAVE_DLQ);
    }

    private QueueBuilder duravel(String nome) {
        return QueueBuilder.durable(nome)
                .deadLetterExchange(Nomes.EXCHANGE_DLX)
                .deadLetterRoutingKey(Nomes.CHAVE_DLQ);
    }

    // servico de validacao consome order.submitted
    @Bean
    Queue filaValidacao() {
        return duravel(Nomes.FILA_VALIDACAO).build();
    }

    @Bean Binding bindValidacao() {
        return BindingBuilder.bind(filaValidacao())
                .to(eventosExchange())
                .with(Nomes.ORDER_SUBMITTED + ".*.*");
    }

    // ordens consome order.validated
    @Bean
    Queue filaOrdens() {
        return duravel(Nomes.FILA_ORDENS).build();
    }

    @Bean
    Binding bindOrdens() {
        return BindingBuilder.bind(filaOrdens())
                .to(eventosExchange())
                .with(Nomes.ORDER_VALIDATED + ".*.*");
    }

    // engine de mercado consome order.accepted
    @Bean
    Declarables filasEngine(Particoes particoes) {
        List<Declarable> itens = new ArrayList<>();

        for (int p = 0; p < particoes.total(); p++) {
            Queue q = duravel(particoes.filaEngine(p))
                    .singleActiveConsumer()
                    .build();

            itens.add(q);
            itens.add(BindingBuilder.bind(q).to(eventosExchange()).with(Nomes.ORDER_ACCEPTED + ".p" + p + ".*"));
        }

        return new Declarables(itens);
    }

    // gateway wbsocket consome
    @Bean
    Queue filaGateway() {
        return duravel(Nomes.FILA_GATEWAY).build();
    }

   @Bean
    Declarables bindingsGateway() {
        return new Declarables(
                BindingBuilder.bind(filaGateway())
                        .to(eventosExchange())
                        .with(Nomes.ORDER_REJECTED + ".*.*"),
                BindingBuilder.bind(filaGateway())
                        .to(eventosExchange())
                        .with(Nomes.ORDER_ACCEPTED + ".*.*"));
    }

    /*
     *
     * o gateway que recebeu o evento publica aqui recebe copia na sua fila
     * anonima e quem tem a sessao do usuario entrega pelo websoct
     *
     * */
    @Bean
    AnonymousQueue pubsubQueue() {
        return new AnonymousQueue();
    }

    @Bean
    Binding bindPubsub() {
        return BindingBuilder.bind(pubsubQueue()).to(pubsubExchange());
    }

    @Bean
    JacksonJsonMessageConverter jsonMessageConverter() {
        return new JacksonJsonMessageConverter();
    }
}