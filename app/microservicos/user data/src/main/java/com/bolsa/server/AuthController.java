package com.bolsa.server;

import jakarta.annotation.PostConstruct;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/auth")
public class AuthController {

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private TokenService tokenService;

    @Autowired
    private RabbitTemplate rabbitTemplate;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public record CredenciaisDTO(String username, String senha) {}

    @PostConstruct
    public void inicializarJogadoresPadrao() {
        criarSeNaoExistir("jogador1", "senha123");
        criarSeNaoExistir("jogador2", "abc456");
    }

    private void criarSeNaoExistir(String username, String senhaPura) {
        if (!usuarioRepository.existsByUsername(username)) {
            Usuario novo = new Usuario(username, passwordEncoder.encode(senhaPura));
            usuarioRepository.save(novo);
        }
    }

    @PostMapping("/cadastrar")
    public ResponseEntity<?> cadastrar(@RequestBody CredenciaisDTO dto) {
        if (dto == null || dto.username() == null || dto.username().isBlank()
                || dto.senha() == null || dto.senha().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("erro", "Username e senha sao obrigatorios"));
        }

        String usernameLimpo = dto.username().trim();
        if (usuarioRepository.existsByUsername(usernameLimpo)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("erro", "Usuario ja cadastrado"));
        }

        Usuario novoUsuario = new Usuario(usernameLimpo, passwordEncoder.encode(dto.senha()));
        usuarioRepository.save(novoUsuario);

        try {
            rabbitTemplate.convertAndSend("usuarios.exchange", "", "CADASTRADO:" + novoUsuario.getUsername());
        } catch (Exception e) {
            System.err.println("[AUTH] Aviso RabbitMQ: " + e.getMessage());
        }

        String token = tokenService.gerarToken(novoUsuario);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "id", novoUsuario.getId(),
                "username", novoUsuario.getUsername(),
                "token", token
        ));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody CredenciaisDTO dto) {
        if (dto == null || dto.username() == null || dto.senha() == null) {
            return ResponseEntity.badRequest().body(Map.of("erro", "Credenciais ausentes"));
        }

        Optional<Usuario> opt = usuarioRepository.findByUsername(dto.username().trim());
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("erro", "Credenciais invalidas"));
        }

        Usuario usuario = opt.get();
        if (usuario.getStatus() != Usuario.StatusConta.ATIVA ||
                !passwordEncoder.matches(dto.senha(), usuario.getSenhaHash())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("erro", "Credenciais invalidas"));
        }

        String token = tokenService.gerarToken(usuario);
        return ResponseEntity.ok(Map.of(
                "id", usuario.getId(),
                "username", usuario.getUsername(),
                "token", token
        ));
    }

    @GetMapping("/validar")
    public ResponseEntity<?> validarToken(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Usuario usuario = autenticarPeloHeader(authHeader);
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("valido", false));
        }

        return ResponseEntity.ok(Map.of(
                "valido", true,
                "id", usuario.getId(),
                "username", usuario.getUsername(),
                "status", usuario.getStatus().name()
        ));
    }

    @DeleteMapping("/me")
    public ResponseEntity<?> deletarMinhaConta(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Usuario usuario = autenticarPeloHeader(authHeader);
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("erro", "Token invalido ou expirado"));
        }

        usuarioRepository.deleteById(usuario.getId());

        try {
            rabbitTemplate.convertAndSend("usuarios.exchange", "", "DELETADO:" + usuario.getUsername());
        } catch (Exception e) {
            System.err.println("[AUTH] Aviso RabbitMQ: " + e.getMessage());
        }

        return ResponseEntity.ok(Map.of(
                "mensagem", "Conta removida com sucesso",
                "username", usuario.getUsername()
        ));
    }

    private Usuario autenticarPeloHeader(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        String token = authHeader.substring(7).trim();
        TokenService.DadosToken dados = tokenService.validarToken(token);
        if (dados == null) {
            return null;
        }
        return usuarioRepository.findById(dados.userId())
                .filter(u -> u.getStatus() == Usuario.StatusConta.ATIVA)
                .orElse(null);
    }
}
