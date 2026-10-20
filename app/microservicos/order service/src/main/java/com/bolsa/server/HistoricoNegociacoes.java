package com.bolsa.server;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

import org.springframework.amqp.core.ExchangeTypes;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.Exchange;
import org.springframework.amqp.rabbit.annotation.Queue;
import org.springframework.amqp.rabbit.annotation.QueueBinding;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class HistoricoNegociacoes {

    public record RegistroNegociacao(long numero, String comprador, String vendedor,
                                     String ativo, int quantidade, double preco,
                                     Instant executadaEm) { }

    private static final int LIMITE_EM_MEMORIA = 500;

    private final Deque<RegistroNegociacao> historico = new ArrayDeque<>();
    private long totalRegistradas = 0;
    private final String host = System.getenv().getOrDefault("HOSTNAME", "local");

    @RabbitListener(bindings = @QueueBinding(
            value = @Queue(value = "q.historico", durable = "true"),
            exchange = @Exchange(value = "trades.exchange", type = ExchangeTypes.FANOUT)))
    public void registrar(Message msg) {
    
        String conteudo = new String(msg.getBody(), StandardCharsets.UTF_8).replace("\"", "").trim();
        String[] partes = conteudo.split(";");

        if (partes.length < 5) {
            System.out.println("[" + host + "] [HISTORICO] trade ignorada, formato inesperado: " + conteudo);
            return;
        }

        try {
            int quantidade = Integer.parseInt(partes[3].trim());
            double preco = Double.parseDouble(partes[4].trim());

            RegistroNegociacao registro = guardar(
                    partes[0].trim(), partes[1].trim(), partes[2].trim(), quantidade, preco);

            System.out.println("[" + host + "] [HISTORICO] #" + registro.numero() + " "
                    + registro.ativo() + " " + registro.quantidade() + "x R$ " + registro.preco()
                    + " | comprador=" + registro.comprador() + " vendedor=" + registro.vendedor());
        } catch (NumberFormatException e) {
            System.out.println("[" + host + "] [HISTORICO] trade ignorada, numero invalido: " + conteudo);
        }
    }

    private synchronized RegistroNegociacao guardar(String comprador, String vendedor, String ativo,
                                                    int quantidade, double preco) {
        totalRegistradas++;
        RegistroNegociacao registro = new RegistroNegociacao(
                totalRegistradas, comprador, vendedor, ativo, quantidade, preco, Instant.now());

        historico.addFirst(registro);
        while (historico.size() > LIMITE_EM_MEMORIA) {
            historico.removeLast();
        }
        return registro;
    }

    public synchronized List<RegistroNegociacao> ultimas(int limite) {
        List<RegistroNegociacao> resultado = new ArrayList<>();
        for (RegistroNegociacao registro : historico) {
            if (resultado.size() >= Math.max(0, limite)) break;
            resultado.add(registro);
        }
        return resultado;
    }

    public synchronized long total() {
        return totalRegistradas;
    }
}