package com.bolsa.server;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;

import jakarta.annotation.PostConstruct;
import org.bson.Document;
import org.springframework.amqp.core.ExchangeTypes;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.Exchange;
import org.springframework.amqp.rabbit.annotation.Queue;
import org.springframework.amqp.rabbit.annotation.QueueBinding;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
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
    private static final String COLECAO_USUARIOS = "usuarios";

    @Autowired
    private RabbitTemplate rabbitTemplate;

    //conexão direta com o mongo
    @Autowired
    private MongoClient mongoClient;

    // Aponta direto para o banco "usuarios_db" e coleção "usuarios" via código!
    private MongoCollection<Document> getColecaoUsuarios() {
        return mongoClient.getDatabase("usuarios_db").getCollection("usuarios");
    }

    private String getHostName() {
        String name = System.getenv("HOSTNAME");
        return (name != null) ? name : "null";
    }

    //jogador1 e jogador2 no Mongo para teste
    @PostConstruct
    public void inicializarJogadoresPadrao() {
        cadastrarJogador("jogador1", "senha123");
        cadastrarJogador("jogador2", "abc456");
    }

    //busca no mongo
   private boolean validarCredenciais(String userId, String senha) {
        if (userId == null || senha == null) return false;

        Document usuario = getColecaoUsuarios().find(new Document("_id", userId)).first();
        if (usuario == null) return false;

        String senhaCorreta = usuario.getString("senha");
        if (senhaCorreta == null) return false;

        return MessageDigest.isEqual(
            senha.getBytes(StandardCharsets.UTF_8),
            senhaCorreta.getBytes(StandardCharsets.UTF_8)
        );
    }
	
	//salvar no mongo
    public boolean cadastrarJogador(String userId, String senha) {
        if (userId == null || userId.isBlank() || senha == null || senha.isBlank()) {
            return false;
        }
        // verifica se já existe no banco usuarios_db
        if (getColecaoUsuarios().find(new Document("_id", userId)).first() != null) {
            return false;
        }

        Document novoUsuario = new Document("_id", userId).append("senha", senha);
        getColecaoUsuarios().insertOne(novoUsuario);
        return true;
    }
    
    public boolean deletarJogador(String userId, String senha) {
        // só permite deletar se o usuário existir e a senha estiver correta
        if (!validarCredenciais(userId, senha)) {
            return false;
        }
        try {
            long deletados = getColecaoUsuarios().deleteOne(new Document("_id", userId)).getDeletedCount();
            return deletados > 0;
        } catch (Exception e) {
            System.err.println("[" + hostname + "] Erro ao deletar no MongoDB: " + e.getMessage());
            return false;
        }
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        try {
            String userId = extrairQuery(session, "userId");
            String senha = extrairQuery(session, "senha");
            String acao = extrairQuery(session, "acao");

            // 1. fluxo de cadastro no mongo
            if ("cadastrar".equalsIgnoreCase(acao)) {
                if (!cadastrarJogador(userId, senha)) {
                    System.out.println("[" + hostname + "] : Tentativa de cadastro recusada para: " + userId);
                    session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Dados invalidos ou usuario indisponivel"));
                    return;
                }
                // Publica apenas o userId (sem a senha) para os outros microsserviços
                rabbitTemplate.convertAndSend("usuarios.exchange", "", userId);
                System.out.println("[" + hostname + "] : Novo jogador cadastrado: " + userId);
            }
            
            // 2. fluxo de exclusão de conta (acao=deletar)
            if ("deletar".equalsIgnoreCase(acao)) {
                if (!deletarJogador(userId, senha)) {
                    System.out.println("[" + hostname + "] : Falha ao deletar conta (credenciais invalidas): " + userId);
                    session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Credenciais invalidas para deletar conta"));
                    return;
                }
                // caso ele estivesse conectado em outra aba, derruba a sessão ativa
                WebSocketSession sessaoAtiva = sessoes.remove(userId);
                if (sessaoAtiva != null && sessaoAtiva.isOpen()) {
                    sessaoAtiva.close(CloseStatus.NORMAL.withReason("Conta excluida"));
                }

                // avisa os outros microsserviços que a conta foi removida
                rabbitTemplate.convertAndSend("usuarios.exchange", "", "DELETADO:" + userId);
                System.out.println("[" + hostname + "] : Conta deletada do MongoDB: " + userId);

                session.sendMessage(new TextMessage("Conta " + userId + " deletada com sucesso.\n"));
                session.close(CloseStatus.NORMAL.withReason("Conta deletada com sucesso"));
                return;
            }

            // 3. fluxo de autenticação no mongoDB
            if (!validarCredenciais(userId, senha)) {
                System.out.println("[" + hostname + "] : Autenticacao falhou para: " + userId);
                session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Credenciais invalidas"));
                return;
            }

            session.getAttributes().put("userId", userId);
            sessoes.put(userId, session);

            // 3. notifica o login via RabbitMQ
            rabbitTemplate.convertAndSend("sessao.exchange", "sessao.login", "Sessao iniciada para: " + userId + " no " + hostname);

            System.out.println("[" + hostname + "] : Conexao - " + userId);
            session.sendMessage(new TextMessage("Ola, " + userId + "\n"));

        } catch (Exception e) {
            // Loga o erro técnico no console interno do servidor
            System.err.println("[" + hostname + "] Erro interno na sessao WebSocket: " + e.getMessage());
            
            // para o cliente nao mostra
            if (session.isOpen()) {
                session.close(CloseStatus.SERVER_ERROR.withReason("Erro interno ao processar conexao"));
            }
        }
    }

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String userId = (String) session.getAttributes().get("userId");
        if (userId == null) return;

        String payload = message.getPayload().trim();

        // se o site enviar "DELETAR_CONTA" enquanto o jogador está logado
        if ("DELETAR_CONTA".equalsIgnoreCase(payload)) {
            getColecaoUsuarios().deleteOne(new Document("_id", userId));
            sessoes.remove(userId);
            rabbitTemplate.convertAndSend("usuarios.exchange", "", "DELETADO:" + userId);
            System.out.println("[" + hostname + "] : Conta deletada pelo proprio usuario logado: " + userId);

            session.sendMessage(new TextMessage("Sua conta foi excluida permanentemente.\n"));
            session.close(CloseStatus.NORMAL.withReason("Conta excluida"));
            return;
        }

        System.out.println("[" + hostname + "] " + userId + " enviou ordem: " + payload);
        rabbitTemplate.convertAndSend("ordens.fila", userId + ":" + payload);
        session.sendMessage(new TextMessage("Ordem enviada para o motor da bolsa: " + payload + "\n"));
    }

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
    
    @RabbitListener(bindings = @QueueBinding(
        value = @Queue(value = "", durable = "false", exclusive = "true", autoDelete = "true"),
        exchange = @Exchange(value = "cruel.eventos", type = ExchangeTypes.TOPIC),
        key = "price.updated.*.*"
    ))
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
