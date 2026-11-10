package com.bolsa.server;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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

    @PostMapping(value = "/cadastrar", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> cadastrar(@RequestBody CredenciaisDTO dto) {
        if (dto == null || dto.username() == null || dto.senha() == null) {
            return ResponseEntity.badRequest().body("{\"erro\":\"Username e senha obrigatorios\"}");
        }
        String comando = "CADASTRAR;" + dto.username().trim() + ";" + dto.senha();
        return enviarComandoRpcParaUserData(comando);
    }

    @PostMapping(value = "/login", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> login(@RequestBody CredenciaisDTO dto) {
        if (dto == null || dto.username() == null || dto.senha() == null) {
            return ResponseEntity.badRequest().body("{\"erro\":\"Credenciais ausentes\"}");
        }
        String comando = "LOGIN;" + dto.username().trim() + ";" + dto.senha();
        return enviarComandoRpcParaUserData(comando);
    }

    @GetMapping("/validar")
    public ResponseEntity<?> validar(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        TokenService.DadosToken dados = extrairDadosDoHeader(authHeader);
        if (dados == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("valido", false));
        }
        Object resp = rabbitTemplate.convertSendAndReceive("auth.rpc.fila", "VERIFICAR;" + dados.userId());
        if (resp == null || !resp.toString().startsWith("200:")) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("valido", false));
        }
        return ResponseEntity.ok(Map.of(
                "valido", true,
                "id", dados.userId(),
                "username", dados.username()
        ));
    }

    @DeleteMapping(value = "/me", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> deletarPropriaConta(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        TokenService.DadosToken dados = extrairDadosDoHeader(authHeader);
        if (dados == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("{\"erro\":\"Token invalido ou expirado\"}");
        }
        String comando = "DELETAR;" + dados.userId() + ";" + dados.username();
        return enviarComandoRpcParaUserData(comando);
    }

    private ResponseEntity<String> enviarComandoRpcParaUserData(String comando) {
        Object respostaObj = rabbitTemplate.convertSendAndReceive("auth.rpc.fila", comando);
        if (respostaObj == null) {
            return ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT)
                    .body("{\"erro\":\"Microsservico user-data nao respondeu no RabbitMQ\"}");
        }
        String resposta = respostaObj.toString();
        String[] partes = resposta.split(":", 2);
        int statusHttp = Integer.parseInt(partes[0]);
        String jsonBody = (partes.length > 1) ? partes[1] : "{}";
        return ResponseEntity.status(statusHttp).body(jsonBody);
    }

    private TokenService.DadosToken extrairDadosDoHeader(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        return tokenService.validarToken(authHeader.substring(7).trim());
    }
}
