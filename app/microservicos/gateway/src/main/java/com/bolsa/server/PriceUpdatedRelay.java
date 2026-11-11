package com.bolsa.server;

import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
/* Redirect para o broker, agora as requisições do rabbit do market
passam pelo gateway
*/
@Component
public class PriceUpdatedRelay {

    private final RabbitTemplate rabbitTemplate;

    public PriceUpdatedRelay(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    @RabbitListener(queues = RabbitConfig.FILA_PRECOS_GATEWAY)
    public void encaminhar(Message mensagem) {
        rabbitTemplate.send(RabbitConfig.EXCHANGE_PUBSUB, "", mensagem);
    }
}
