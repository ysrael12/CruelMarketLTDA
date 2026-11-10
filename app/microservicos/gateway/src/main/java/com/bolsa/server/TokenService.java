package com.bolsa.server;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;

@Service
public class TokenService {

    private static final String SECRET_KEY = System.getenv().getOrDefault(
        "JWT_SECRET", "ChaveSecretaHmacCruelMarketLTDA2026_SegurancaTotal!"
    );

    private static final long TEMPO_EXPIRACAO_SEGUNDOS = 86400; // 24h

    @Autowired
    private RabbitTemplate rabbitTemplate;

    public record DadosToken(String userId, String username, long expiraEm) {}

    public ResponseEntity<?> cadastrar(GatewayAuthController.CredenciaisDTO dto) {
        if (dto == null || dto.username() == null || dto.username().isBlank()
                || dto.senha() == null || dto.senha().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("erro", "Username e senha obrigatorios"));
        }
        String comando = "CADASTRAR;" + dto.username().trim() + ";" + dto.senha();
        return processarLoginOuCadastroNoRabbit(comando);
    }

    public ResponseEntity<?> login(GatewayAuthController.CredenciaisDTO dto) {
        if (dto == null || dto.username() == null || dto.senha() == null) {
            return ResponseEntity.badRequest().body(Map.of("erro", "Credenciais ausentes"));
        }
        String comando = "LOGIN;" + dto.username().trim() + ";" + dto.senha();
        return processarLoginOuCadastroNoRabbit(comando);
    }

    public ResponseEntity<?> validar(String authHeader) {
        DadosToken dados = verificarTokenNoService(authHeader);
        if (dados == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("valido", false));
        }
        return ResponseEntity.ok(Map.of(
                "valido", true,
                "id", dados.userId(),
                "username", dados.username()
        ));
    }

    public ResponseEntity<?> deletarPropriaConta(String authHeader) {
        DadosToken dados = verificarTokenNoService(authHeader);
        if (dados == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("erro", "Token invalido ou expirado"));
        }

        Object respObj = rabbitTemplate.convertSendAndReceive("usuarios.rpc.fila",
                "DELETAR;" + dados.userId() + ";" + dados.username());

        if (respObj == null) {
            return ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT)
                    .body(Map.of("erro", "user-data nao respondeu"));
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

    public DadosToken verificarTokenNoService(String authHeaderOuToken) {
        if (authHeaderOuToken == null || authHeaderOuToken.isBlank()) return null;
        String token = authHeaderOuToken.startsWith("Bearer ")
                ? authHeaderOuToken.substring(7).trim()
                : authHeaderOuToken.trim();

        DadosToken dados = validarAssinaturaHmac(token);
        if (dados == null) return null;

        Object respObj = rabbitTemplate.convertSendAndReceive("usuarios.rpc.fila", "VERIFICAR;" + dados.userId());
        if (respObj == null || !respObj.toString().equals("true")) {
            return null;
        }
        return dados;
    }

    private ResponseEntity<?> processarLoginOuCadastroNoRabbit(String comando) {
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
            String token = gerarToken(userId, username);
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

    public String gerarToken(String userId, String username) {
        long expiraEm = Instant.now().getEpochSecond() + TEMPO_EXPIRACAO_SEGUNDOS;
        String payload = String.join(":", userId, username, String.valueOf(expiraEm));

        String payloadBase64 = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        String assinatura = assinarHmac(payloadBase64);

        return payloadBase64 + "." + assinatura;
    }

    public DadosToken validarAssinaturaHmac(String token) {
        if (token == null || token.isBlank() || !token.contains(".")) return null;

        String[] partes = token.split("\\.");
        if (partes.length != 2) return null;

        String payloadBase64 = partes[0];
        String assinaturaRecebida = partes[1];
        String assinaturaCalculada = assinarHmac(payloadBase64);

        if (!MessageDigest.isEqual(
                assinaturaRecebida.getBytes(StandardCharsets.UTF_8),
                assinaturaCalculada.getBytes(StandardCharsets.UTF_8))) {
            return null;
        }

        try {
            String payload = new String(Base64.getUrlDecoder().decode(payloadBase64), StandardCharsets.UTF_8);
            String[] campos = payload.split(":");
            if (campos.length != 3) return null;

            long expiraEm = Long.parseLong(campos[2]);
            if (Instant.now().getEpochSecond() > expiraEm) return null;

            return new DadosToken(campos[0], campos[1], expiraEm);
        } catch (Exception e) {
            return null;
        }
    }

    private String assinarHmac(String dados) {
        try {
            Mac hmac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(SECRET_KEY.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            hmac.init(secretKey);
            byte[] hash = hmac.doFinal(dados.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao assinar/verificar token", e);
        }
    }
}
