package com.bolsa.server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@SpringBootApplication
@RestController
public class ServerApplication {

	public static void main(String[] args) {
		SpringApplication.run(ServerApplication.class, args);
	}
	@PostMapping("/ordem")
    public ResponseEntity<String> criarOrdem(
            @RequestHeader(value = "X-Jogador", required = false) String jogador,
            @RequestHeader(value = "X-Senha", required = false) String senha,
            @RequestBody(required = false) String dadosDaOrdem) {

        if (!Auth.loginValido(jogador, senha)) {
            return ResponseEntity.status(401).body("Erro 401: Jogador ou senha incorretos!\n");
        }
        return ResponseEntity.ok("Bem vindo " + jogador + "!\n");
    }

}
