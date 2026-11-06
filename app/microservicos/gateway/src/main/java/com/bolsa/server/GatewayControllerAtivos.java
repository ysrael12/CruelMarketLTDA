package com.bolsa.server;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController 
@RequestMapping("/ativos")
public class GatewayControllerAtivos{
    private final GatewayService gatewayService;

    public GatewayControllerAtivos(GatewayService gatewayService){
        this.gatewayService = gatewayService;
    }

    @GetMapping
    public ResponseEntity<?> getAtivos() {
        try {
            String resp = gatewayService.obterAtivos();
            return ResponseEntity.ok()
            .header("Content-Type", "application/json")
            .body(resp);
        } catch (RuntimeException e){
            return ResponseEntity.status(504).body("erro: " + e.getMessage());
        }
    }
}