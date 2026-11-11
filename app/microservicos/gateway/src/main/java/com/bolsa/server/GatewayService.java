package com.bolsa.server;

import java.net.URI;
import java.util.Map;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriComponentsBuilder;

@Service
public class GatewayService {

    private final TokenService tokenService;
    private final RabbitTemplate template;
    private final RestClient restClient;

    @Autowired
    public GatewayService(
            RabbitTemplate template,
            TokenService tokenService,
            @Value("${cruel.market-data.base-url:http://market-data:3000}") String marketDataBaseUrl
    ) {
        this.template = template;
        this.tokenService = tokenService;
        this.restClient = RestClient.builder().baseUrl(marketDataBaseUrl).build();
    }

    /* o Porteiro XD manda para o micro serviço marketdata */
    public ResponseEntity<?> encaminharMarketData(HttpMethod method, String path,
            MultiValueMap<String, String> query, Object body) {
        URI uri = UriComponentsBuilder.fromPath(path)
                .queryParams(query)
                .build(true)
                .toUri();
        try {
            RestClient.RequestBodySpec request = restClient.method(method).uri(uri);
            if (body != null) {
                request.body(body);
            }
            return request.exchange((outgoing, response) -> ResponseEntity
                            .status(response.getStatusCode())
                            .headers(headers -> headers.putAll(response.getHeaders()))
                            .body(response.getBody().readAllBytes()));
        } catch (RestClientException e) {
            return ResponseEntity.status(502)
                    .body(Map.of("erro", "Erro ao consultar serviço market-data"));
        }
    }

    public ResponseEntity<?> obterAtivosAutenticado(String tokenAuth) {
        TokenService.DadosToken usuario = tokenService.verificarTokenNoService(tokenAuth);
        if (usuario == null) {
            return ResponseEntity.status(401).body("Token invalido ou expirado");
        }
        return encaminharMarketData(HttpMethod.GET, "/ativos", new org.springframework.util.LinkedMultiValueMap<>(), null);
    }
}
