package com.bolsa.server;

import org.springframework.amqp.core.ExchangeTypes;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.Exchange;
import org.springframework.amqp.rabbit.annotation.Queue;
import org.springframework.amqp.rabbit.annotation.QueueBinding;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SessionHandler extends TextWebSocketHandler {

    private final Map<String, WebSocketSession> sessoes = new ConcurrentHashMap<>();
    private final String hostname = getHostName();

    @Autowired
    private RabbitTemplate rabbitTemplate;

    private String getHostName() {
        String name = System.getenv("HOSTNAME");
        return (name != null) ? name : "null";
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String userId = session.getHandshakeHeaders().getFirst("X-Authenticated-User");

        if (userId == null || userId.isBlank()) {
            System.out.println("[" + hostname + "] : conexão recusada sem identidade autenticada");
            session.close(CloseStatus.POLICY_VIOLATION.withReason("Identidade não autenticada"));
            return;
        }

        session.getAttributes().put("userId", userId);
        sessoes.put(userId, session);

        rabbitTemplate.convertAndSend("sessao.exchange", "sessao.login", "Sessao iniciada para: " + userId + " no " + hostname);

        System.out.println("[" + hostname + "] : Conexao - " + userId);
        session.sendMessage(new TextMessage("Hello, " + userId + "\n"));
    }

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String userId = (String) session.getAttributes().get("userId");
        if (userId == null) return;

        String payload = message.getPayload().trim();
        System.out.println("[" + hostname + "] " + userId + " enviou ordem: " + payload);

        rabbitTemplate.convertAndSend("ordens.fila", userId + ":" + payload);

        session.sendMessage(new TextMessage("Ordem enviada para o motor da bolsa: " + payload + "\n"));
    }

    // Recebe o aviso de trade do motor da bolsa e envia para a tela dos jogadores conectados neste servidor
    @RabbitListener(bindings = @QueueBinding(
        value = @Queue(value = "", durable = "false", exclusive = "true", autoDelete = "true"),
        exchange = @Exchange(value = "trades.exchange", type = ExchangeTypes.FANOUT)
    ))
    public void notificarTradeAosJogadores(Message msg) {
        try {
            String conteudo = new String(msg.getBody(), StandardCharsets.UTF_8)
                    .replace("\"", "").trim();
            String[] partes = conteudo.split(";");
            if (partes.length < 5) return;

            String comprador = partes[0];
            String vendedor = partes[1];
            String ativo = partes[2];
            String qtd = partes[3];
            String preco = partes[4];

            WebSocketSession sessaoComprador = sessoes.get(comprador);
            if (sessaoComprador != null && sessaoComprador.isOpen()) {
                sessaoComprador.sendMessage(new TextMessage(
                    "[MATCH!] COMPRA EXECUTADA: " + qtd + "x " + ativo + " a R$ " + preco + " (Vendedor: " + vendedor + ")\n"
                ));
            }

            WebSocketSession sessaoVendedor = sessoes.get(vendedor);
            if (sessaoVendedor != null && sessaoVendedor.isOpen()) {
                sessaoVendedor.sendMessage(new TextMessage(
                    "[MATCH!] VENDA EXECUTADA: " + qtd + "x " + ativo + " a R$ " + preco + " (Comprador: " + comprador + ")\n"
                ));
            }
        } catch (Exception e) {
            System.out.println("[" + hostname + "] Erro ao notificar jogador: " + e.getMessage());
        }
    }

    // Recebe preços encaminhados pelo gateway via fanout; cada instância tem sua própria fila.
    @RabbitListener(queues = "#{pubsubQueue.name}")
    public void notificarPrecoAosJogadores(Message msg) {
        try {
            String json = new String(msg.getBody(), StandardCharsets.UTF_8);
            TextMessage saida = new TextMessage(json);

            for (WebSocketSession sessao : sessoes.values()) {
                if (!sessao.isOpen()) continue;
                try {
                    sessao.sendMessage(saida);
                } catch (Exception e) {
                    System.out.println("[" + hostname + "] Falha ao enviar preco: " + e.getMessage());
                }
            }
        } catch (Exception e) {
            System.out.println("[" + hostname + "] Erro ao repassar preco: " + e.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String userId = (String) session.getAttributes().get("userId");
        if (userId != null) {
            sessoes.remove(userId);
            rabbitTemplate.convertAndSend("sessao.exchange", "sessao.logout", "Sessao encerrada para: " + userId);
        }
        System.out.println("[" + hostname + "] Desconectado: " + userId);
    }

}
