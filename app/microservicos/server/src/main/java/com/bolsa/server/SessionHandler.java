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

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
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

    private static final Map<String, String> JOGADORES_AUTORIZADOS = Map.of(
        "jogador1", "senha123",
        "jogador2", "abc456"
    );

    private boolean validarCredenciais(String userId, String senha) {
        if (userId == null || senha == null) return false;
        String senhaCorreta = JOGADORES_AUTORIZADOS.get(userId);
        if (senhaCorreta == null) return false;
        return MessageDigest.isEqual(
            senha.getBytes(StandardCharsets.UTF_8),
            senhaCorreta.getBytes(StandardCharsets.UTF_8)
        );
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String userId = extrairQuery(session, "userId");
        String senha = extrairQuery(session, "senha");

        if (!validarCredenciais(userId, senha)) {
            System.out.println("[" + hostname + "] : Autenticacao falhou para: " + userId);
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Credenciais invalidas"));
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

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String userId = (String) session.getAttributes().get("userId");
        if (userId != null) {
            sessoes.remove(userId);
            rabbitTemplate.convertAndSend("sessao.exchange", "sessao.logout", "Sessao encerrada para: " + userId);
        }
        System.out.println("[" + hostname + "] Desconectado: " + userId);
    }

    private String extrairQuery(WebSocketSession session, String chave) {
        URI uri = session.getUri();
        if (uri == null || uri.getQuery() == null) return null;
        for (String p : uri.getQuery().split("&")) {
            String[] kv = p.split("=");
            if (kv.length == 2 && kv[0].equals(chave)) return kv[1];
        }
        return null;
    }
}
