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

    @RabbitListener(queues = "usuarios.rpc.fila")
    public String processarComandoAuth(String mensagem) {
        try {
            String[] partes = mensagem.split(";", 3);
            String acao = partes[0];

            switch (acao) {
                case "CADASTRAR" -> {
                    String username = partes[1];
                    String senha = partes[2];
                    if (usuarioRepository.existsByUsername(username)) {
                        return "ERRO;409;Usuario ja cadastrado";
                    }
                    Usuario novo = new Usuario(username, passwordEncoder.encode(senha));
                    usuarioRepository.save(novo);
                    rabbitTemplate.convertAndSend("usuarios.exchange", "", "CADASTRADO:" + username);
                    return "CRIADO;" + novo.getId() + ";" + novo.getUsername();
                }
                case "LOGIN" -> {
                    String username = partes[1];
                    String senha = partes[2];
                    Optional<Usuario> opt = usuarioRepository.findByUsername(username);
                    if (opt.isEmpty() || !passwordEncoder.matches(senha, opt.get().getSenhaHash())) {
                        return "ERRO;401;Credenciais invalidas";
                    }
                    Usuario usuario = opt.get();
                    if (usuario.getStatus() != Usuario.StatusConta.ATIVA) {
                        return "ERRO;401;Conta bloqueada";
                    }
                    return "OK;" + usuario.getId() + ";" + usuario.getUsername();
                }
                case "VERIFICAR" -> {
                    String userId = partes[1];
                    boolean ativo = usuarioRepository.findById(userId)
                            .map(u -> u.getStatus() == Usuario.StatusConta.ATIVA)
                            .orElse(false);
                    return ativo ? "true" : "false";
                }
                case "DELETAR" -> {
                    String userId = partes[1];
                    String username = partes[2];
                    if (!usuarioRepository.existsById(userId)) {
                        return "ERRO;404;Usuario nao encontrado";
                    }
                    usuarioRepository.deleteById(userId);
                    rabbitTemplate.convertAndSend("usuarios.exchange", "", "DELETADO:" + username);
                    return "DELETADO;" + username;
                }
                default -> {
                    return "ERRO;400;Acao desconhecida";
                }
            }
        } catch (Exception e) {
            return "ERRO;500;" + e.getMessage();
        }
    }
}
