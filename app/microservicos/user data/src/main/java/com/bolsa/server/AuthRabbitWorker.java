package com.bolsa.server;

import jakarta.annotation.PostConstruct;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class AuthRabbitWorker {

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private TokenService tokenService;

    @Autowired
    private RabbitTemplate rabbitTemplate;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @PostConstruct
    public void inicializarJogadoresPadrao() {
        if (!usuarioRepository.existsByUsername("jogador1")) {
            usuarioRepository.save(new Usuario("jogador1", passwordEncoder.encode("senha123")));
        }
        if (!usuarioRepository.existsByUsername("jogador2")) {
            usuarioRepository.save(new Usuario("jogador2", passwordEncoder.encode("abc456")));
        }
    }

    @RabbitListener(queues = "auth.rpc.fila")
    public String processarComandoAuth(String mensagem) {
        try {
            String[] partes = mensagem.split(";", 3);
            String acao = partes[0];

            switch (acao) {
                case "CADASTRAR" -> {
                    String username = partes[1];
                    String senha = partes[2];
                    if (usuarioRepository.existsByUsername(username)) {
                        return "409:{\"erro\":\"Usuario ja cadastrado\"}";
                    }
                    Usuario novo = new Usuario(username, passwordEncoder.encode(senha));
                    usuarioRepository.save(novo);
                    rabbitTemplate.convertAndSend("usuarios.exchange", "", "CADASTRADO:" + username);
                    String token = tokenService.gerarToken(novo);
                    return String.format("201:{\"id\":\"%s\",\"username\":\"%s\",\"token\":\"%s\"}",
                            novo.getId(), novo.getUsername(), token);
                }
                case "LOGIN" -> {
                    String username = partes[1];
                    String senha = partes[2];
                    Optional<Usuario> opt = usuarioRepository.findByUsername(username);
                    if (opt.isEmpty() || !passwordEncoder.matches(senha, opt.get().getSenhaHash())) {
                        return "401:{\"erro\":\"Credenciais invalidas\"}";
                    }
                    Usuario u = opt.get();
                    String token = tokenService.gerarToken(u);
                    return String.format("200:{\"id\":\"%s\",\"username\":\"%s\",\"token\":\"%s\"}",
                            u.getId(), u.getUsername(), token);
                }
                case "VERIFICAR" -> {
                    String userId = partes[1];
                    boolean ativo = usuarioRepository.findById(userId)
                            .map(u -> u.getStatus() == Usuario.StatusConta.ATIVA)
                            .orElse(false);
                    return ativo ? "200:ATIVO" : "401:INATIVO";
                }
                case "DELETAR" -> {
                    String userId = partes[1];
                    String username = partes[2];
                    usuarioRepository.deleteById(userId);
                    rabbitTemplate.convertAndSend("usuarios.exchange", "", "DELETADO:" + username);
                    return String.format("200:{\"mensagem\":\"Conta removida com sucesso\",\"username\":\"%s\"}", username);
                }
                default -> {
                    return "400:{\"erro\":\"Comando desconhecido\"}";
                }
            }
        } catch (Exception e) {
            return "500:{\"erro\":\"" + e.getMessage() + "\"}";
        }
    }
}
