package com.bolsa.server.broker;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.core.ExchangeTypes;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.Argument;
import org.springframework.amqp.rabbit.annotation.Exchange;
import org.springframework.amqp.rabbit.annotation.Queue;
import org.springframework.amqp.rabbit.annotation.QueueBinding;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

@Component
public class PonteTrades {

    private static final String FILA = "q.ponte.trades";

    private final RabbitTemplate rabbit;
    private final Particoes particoes;
    private final String host = System.getenv().getOrDefault("HOSTNAME", "local");

    public PonteTrades(RabbitTemplate rabbit, Particoes particoes) {
        this.rabbit = rabbit;
        this.particoes = particoes;
    }

    @RabbitListener(bindings = @QueueBinding(
            value = @Queue(value = FILA, durable = "true", arguments = {
                    @Argument(name = "x-dead-letter-exchange", value = Nomes.EXCHANGE_DLX),
                    @Argument(name = "x-dead-letter-routing-key", value = Nomes.CHAVE_DLQ)
            }),
            exchange = @Exchange(value = "trades.exchange", type = ExchangeTypes.FANOUT)))
    public void encaminhar(Message msg) {
        String conteudo = new String(msg.getBody(), StandardCharsets.UTF_8).replace("\"", "").trim();
        String[] partes = conteudo.split(";");

        if (partes.length < 5) {
            throw new AmqpRejectAndDontRequeueException("trade em formato inesperado: " + conteudo);
        }

        String comprador = partes[0].trim();
        String vendedor = partes[1].trim();
        String ativo = partes[2].trim().toUpperCase();
        int quantidade;
        double preco;

        try {
            quantidade = Integer.parseInt(partes[3].trim());
            preco = Double.parseDouble(partes[4].trim());
        } catch (NumberFormatException e) {
            throw new AmqpRejectAndDontRequeueException("trade com numero invalido: " + conteudo, e);
        }

        if (ativo.isEmpty() || quantidade <= 0 || preco <= 0) {
            throw new AmqpRejectAndDontRequeueException("trade com valores invalidos: " + conteudo);
        }

        //Isso é até o OrderService incluir os ids reais
        EventoTradeMercado evento = new EventoTradeMercado(
                UUID.randomUUID().toString(),
                UUID.randomUUID().toString(),
                ativo,
                quantidade,
                preco,
                System.currentTimeMillis());

        String chave = particoes.chave(Nomes.TRADE_EXECUTED, ativo);
        rabbit.convertAndSend(Nomes.EXCHANGE_EVENTOS, chave, evento);

        System.out.println("[" + host + "] [ponte] " + chave + " " + quantidade + "x " + ativo
                + " a " + preco + " (" + comprador + " x " + vendedor + ")");
    }
}