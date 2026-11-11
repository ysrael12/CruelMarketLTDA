package com.bolsa.server;

import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/* criei um arquivo só para o market data */
@RestController
public class GatewayControllerAtivos {
    private final GatewayService gatewayService;

    public GatewayControllerAtivos(GatewayService gatewayService) {
        this.gatewayService = gatewayService;
    }

    @RequestMapping(value = {"/ativos", "/ativos/{ticker}", "/ativos/{ticker}/historico"},
            method = RequestMethod.GET)
    public ResponseEntity<?> ativos(@RequestParam MultiValueMap<String, String> query,
            jakarta.servlet.http.HttpServletRequest request) {
        return gatewayService.encaminharMarketData(HttpMethod.GET, request.getRequestURI(), query, null);
    }

    @RequestMapping(value = {"/eventos", "/health"}, method = RequestMethod.GET)
    public ResponseEntity<?> leitura(@RequestParam MultiValueMap<String, String> query,
            jakarta.servlet.http.HttpServletRequest request) {
        return gatewayService.encaminharMarketData(HttpMethod.GET, request.getRequestURI(), query, null);
    }

    @RequestMapping(value = "/eventos", method = RequestMethod.POST)
    public ResponseEntity<?> dispararEvento(@RequestBody(required = false) byte[] body) {
        return gatewayService.encaminharMarketData(HttpMethod.POST, "/eventos", new org.springframework.util.LinkedMultiValueMap<>(), body);
    }
}
