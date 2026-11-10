package com.bolsa.server;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
public class GatewayAuthController {

    @Autowired
    private RabbitTemplate rabbitTemplate;

    @Autowired
    private TokenService tokenService;

    public record CredenciaisDTO(String username, String senha) {}

    @PostMapping("/cadastrar")
    public ResponseEntity<?> cadastrar(@RequestBody CredenciaisDTO dto) {
        if (dto == null || dto.username() == null || dto.username().isBlank()
                || dto.senha() == null || dto.senha().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("erro", "Username e senha obrigatorios"));
        }
        String comando = "CADASTRAR;" + dto.username().trim() + ";" + dto.senha();
        return processarLoginOuCadastroViaRabbit(comando);
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody CredenciaisDTO dto) {
        if (dto == null || dto.username() == null || dto.senha() == null) {
            return ResponseEntity.badRequest().body(Map.of("erro", "Credenciais ausentes"));
        }
        String comando = "LOGIN;" + dto.username().trim() + ";" + dto.senha();
        return processarLoginOuCadastroViaRabbit(comando);
    }


    @GetMapping("/validar")
    public ResponseEntity<?> validar(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        TokenService.DadosToken dados = extrairTokenNoGateway(authHeader);
        if (dados == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("valido", false));
        }
        return ResponseEntity.ok(Map.of(
                "valido", true,
                "id", dados.userId(),
                "username", dados.username()
        ));
    }


    @DeleteMapping("/me")
    public ResponseEntity<?> deletarPropriaConta(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        TokenService.DadosToken dados = extrairTokenNoGateway(authHeader);
        if (dados == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("erro", "Token invalido ou expirado"));
        }

        Object respObj = rabbitTemplate.convertSendAndReceive("usuarios.rpc.fila",
                "DELETAR;" + dados.userId() + ";" + dados.username());

        if (respObj == null) {
            return ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT).body(Map.of("erro", "user-data nao respondeu"));
        }

        String resp = respObj.toString();
        if (resp.startsWith("DELETADO;")) {
            return ResponseEntity.ok(Map.of(
                    "mensagem", "Conta removida com sucesso",
                    "username", dados.username()
            ));
        }

        String[] erro = resp.split(";", 3);
        return ResponseEntity.status(Integer.parseInt(erro[1])).body(Map.of("erro", erro[2]));
    }

    private ResponseEntity<?> processarLoginOuCadastroViaRabbit(String comando) {
        Object respObj = rabbitTemplate.convertSendAndReceive("usuarios.rpc.fila", comando);
        if (respObj == null) {
            return ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT)
                    .body(Map.of("erro", "O servico user-data nao respondeu pelo RabbitMQ"));
        }

        String resp = respObj.toString();
        String[] partes = resp.split(";", 3);

        if (partes[0].equals("CRIADO") || partes[0].equals("OK")) {
            String userId = partes[1];
            String username = partes[2];
            String token = tokenService.gerarToken(userId, username);
            HttpStatus status = partes[0].equals("CRIADO") ? HttpStatus.CREATED : HttpStatus.OK;

            return ResponseEntity.status(status).body(Map.of(
                    "id", userId,
                    "username", username,
                    "token", token
            ));
        }

        int statusErro = Integer.parseInt(partes[1]);
        return ResponseEntity.status(statusErro).body(Map.of("erro", partes[2]));
    }

    private TokenService.DadosToken extrairTokenNoGateway(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        return tokenService.validarToken(authHeader.substring(7).trim());
    }
}
