package com.bolsa.server;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.util.UriComponentsBuilder;

@RestController
@RequestMapping("/auth")
public class GatewayAuthController {

    private final TokenService tokenService;

    public GatewayAuthController(TokenService tokenService) {
        this.tokenService = tokenService;
    }

    public record CredenciaisDTO(String username, String senha) {}

    @PostMapping("/cadastrar")
    public ResponseEntity<?> cadastrar(@RequestBody CredenciaisDTO dto) {
        return tokenService.cadastrar(dto);
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody CredenciaisDTO dto) {
        return tokenService.login(dto);
    }

    @GetMapping("/validar")
    public ResponseEntity<?> validar(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        return tokenService.validar(authHeader);
    }

    /** Validação usada pelo subrequest interno do Nginx antes do upgrade WebSocket. */
    @GetMapping("/ws-validar")
    public ResponseEntity<Void> validarHandshakeWebSocket(
            @RequestHeader(value = "X-Original-URI", required = false) String uriOriginal) {
        if (uriOriginal == null) {
            return ResponseEntity.status(401).build();
        }

        var parametros = UriComponentsBuilder.fromUriString(uriOriginal).build().getQueryParams();
        String userId = parametros.getFirst("userId");
        String senha = parametros.getFirst("senha");
        ResponseEntity<?> autenticacao = tokenService.autenticarCredenciais(userId, senha);
        if (!autenticacao.getStatusCode().is2xxSuccessful()) {
            return ResponseEntity.status(autenticacao.getStatusCode()).build();
        }

        String username = ((TokenService.UsuarioAutenticado) autenticacao.getBody()).username();
        return ResponseEntity.noContent()
                .header("X-Authenticated-User", username)
                .build();
    }

    @DeleteMapping("/me")
    public ResponseEntity<?> deletarPropriaConta(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        return tokenService.deletarPropriaConta(authHeader);
    }
}
