package com.bolsa.server;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration 
public class RabbitConfig{

    //nomes copiados de Nomes.java em order service
    public static final String EXCHANGE_EVENTOS = "cruel.eventos";
    public static final String EXCHANGE_PUBSUB = "cruel.pubsub";
    public static final String EXCHANGE_DLX = "cruel.dlx";
    public static final String FILA_DLQ = "cruel.dlq";
    public static final String CHAVE_DLQ = "dead";

    // fila dos servicos
    public static final String FILA_VALIDACAO = "q.validacao";
    public static final String FILA_ENGINE = "q.engine.p";
    public static final String FILA_GATEWAY = "q.gateway";
    public static final String FILA_ORDENS = "q.ordens";

    // eventos
    public static final String ORDER_SUBMITTED = "order.submitted";
    public static final String ORDER_VALIDATED = "order.validated";
    public static final String ORDER_REJECTED = "order.rejected";
    public static final String ORDER_ACCEPTED = "order.accepted";
    public static final String PRICE_UPDATED = "price.updated";
    public static final String TRADE_EXECUTED = "trade.executed";

    public static final String EXCHANGE = "api.exchange";
    public static final String FILA_MD = "q.mercado";
    public static final String ROUTING_KEY_MD = "md.request";

    @Bean 
    public DirectExchange exchange(){
        return new DirectExchange(EXCHANGE);
    }

    @Bean
    public Queue filaMd() {
        return new Queue(FILA_MD);
    }

    @Bean
    public Binding bindingAtivos(Queue filaMd, DirectExchange exchange) {
        return BindingBuilder.bind(filaMd).to(exchange).with(ROUTING_KEY_MD);
    }
}