package com.bolsa.server;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
public class GatewayAuthController {

    @Autowired
    private TokenService tokenService;

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

    @DeleteMapping("/me")
    public ResponseEntity<?> deletarPropriaConta(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        return tokenService.deletarPropriaConta(authHeader);
    }
}
