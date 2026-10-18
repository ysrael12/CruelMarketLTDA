package com.bolsa.server;

import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.Queue;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class OrderBookService {

    @Autowired
    private RabbitTemplate rabbitTemplate;

    private final List<Ordem> compras = new ArrayList<>();
    private final List<Ordem> vendas = new ArrayList<>();
    private final AtomicLong sequencia = new AtomicLong(0);

    @RabbitListener(queuesToDeclare = @Queue(name = "ordens.fila", durable = "true"))
    public synchronized void receberOrdem(Message msg) {
        String mensagem = new String(msg.getBody(), StandardCharsets.UTF_8)
                .replace("\"", "").trim();
        System.out.println("[MOTOR DA BOLSA] Recebido da fila: " + mensagem);

        try {
            String[] partesUsuario = mensagem.split(":");
            String usuario = partesUsuario[0].trim();
            String[] dados = partesUsuario[1].trim().split("\\s+");

            String tipo = dados[0].toUpperCase();
            String ativo = dados[1].toUpperCase();
            int quantidade = Integer.parseInt(dados[2]);
            double preco = Double.parseDouble(dados[3]);

            if (quantidade <= 0 || preco <= 0) return;

            Ordem novaOrdem = new Ordem(sequencia.incrementAndGet(), usuario, tipo, ativo, quantidade, preco);

            if (tipo.equals("COMPRA")) {
                compras.add(novaOrdem);
                compras.sort(Comparator.comparingDouble((Ordem o) -> o.preco).reversed()
                        .thenComparingLong(o -> o.id));
            } else if (tipo.equals("VENDA")) {
                vendas.add(novaOrdem);
                vendas.sort(Comparator.comparingDouble((Ordem o) -> o.preco)
                        .thenComparingLong(o -> o.id));
            }

            cruzarOrdens(ativo);

        } catch (Exception e) {
            System.out.println("[ERRO] Formato invalido: " + mensagem);
        }
    }

    private void cruzarOrdens(String ativo) {
        for (Ordem c : compras) {
            if (!c.ativo.equals(ativo) || c.quantidade <= 0) continue;

            for (Ordem v : vendas) {
                if (!v.ativo.equals(ativo) || v.quantidade <= 0) continue;

                if (c.usuario.equals(v.usuario)) continue;

                if (c.preco >= v.preco) {
                    int qtdNegociada = Math.min(c.quantidade, v.quantidade);
                    double precoExecucao = (c.id < v.id) ? c.preco : v.preco;

                    c.quantidade -= qtdNegociada;
                    v.quantidade -= qtdNegociada;

                    System.out.println("[TRADE EXECUTADA!] Ativo: " + ativo);
                    System.out.println("Comprador: " + c.usuario + " | Vendedor: " + v.usuario);
                    System.out.println("Quantidade: " + qtdNegociada + " | Preco Executado: R$ " + precoExecucao);

                    // Envia o resultado de volta para os servidores WebSocket notificarem os jogadores
                    String eventoTrade = c.usuario + ";" + v.usuario + ";" + ativo + ";" + qtdNegociada + ";" + precoExecucao;
                    rabbitTemplate.convertAndSend("trades.exchange", "", eventoTrade);

                    if (c.quantidade == 0) break;
                }
            }
        }
        compras.removeIf(o -> o.quantidade <= 0);
        vendas.removeIf(o -> o.quantidade <= 0);
    }

    private static class Ordem {
        long id;
        String usuario, tipo, ativo;
        int quantidade;
        double preco;

        Ordem(long id, String usuario, String tipo, String ativo, int quantidade, double preco) {
            this.id = id;
            this.usuario = usuario;
            this.tipo = tipo;
            this.ativo = ativo;
            this.quantidade = quantidade;
            this.preco = preco;
        }
    }
}
