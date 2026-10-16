package com.bolsa.server;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.net.URI;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SessionHandler extends TextWebSocketHandler {

    private final Map<String, WebSocketSession> sessoes = new ConcurrentHashMap<>();
    private final String hostname = getHostName();

    private String getHostName(){
        String name = System.getenv("HOSTNAME");
        if (name == null){
            name = new String("null");
        } 
        return name;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String userId = extrairQuery(session, "userId");
        if (userId == null) userId = "anom-" + session.getId();

        session.getAttributes().put("userId", userId);
        sessoes.put(userId, session);

        System.out.println("[" + hostname + "] : Conexao - " + userId);
        session.sendMessage(new TextMessage("Hello, " + userId+"\n"));
    }

    @Override 
    public void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String userId = (String) session.getAttributes().get("userId");
        System.out.println("[" + hostname + "] " + userId + " mensagem: " + message.getPayload());

        session.sendMessage(new TextMessage("echo! " + message.getPayload()));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String userId = (String) session.getAttributes().get("userId");
        if (userId != null) sessoes.remove(userId);
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