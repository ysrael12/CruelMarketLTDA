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
    
    private static final Map<String, String> JOGADORES_AUTORIZADOS = Map.of(
        "jogador1", "senha123",
        "jogador2", "abc456"
    );

    private boolean validarCredenciais(String userId, String senha) {
        if (userId == null || senha == null) {
            return false;
        }
        String senhaCorreta = JOGADORES_AUTORIZADOS.get(userId);
        if (senhaCorreta == null) {
            return false;
        }
        return java.security.MessageDigest.isEqual(
            senha.getBytes(java.nio.charset.StandardCharsets.UTF_8),
            senhaCorreta.getBytes(java.nio.charset.StandardCharsets.UTF_8)
        );
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
		String userId = extrairQuery(session, "userId");
		String senha = extrairQuery(session, "senha");

			// Validação
		if (!validarCredenciais(userId, senha)) {
			System.out.println("[" + hostname + "] : Autenticacao falhou para o usuario: " + userId);
			session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Credenciais invalidas"));
			return;
		}

        session.getAttributes().put("userId", userId);
        sessoes.put(userId, session);
        
        // Envia um evento de sessão para o rabbit
        rabbitTemplate.convertAndSend("sessao.exchange", "sessao.login", "Sessao iniciada para: " + userId + " no " + hostname);

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
        if (userId != null){
			sessoes.remove(userId);
			
			//Envia um evento de sessão encerrada para o rabbit
			rabbitTemplate.convertAndSend("sessao.exchange", "sessao.logout", "Sessao encerrada para: " + userId);
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
