package com.bolsa.server;

import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;

@Service
public class TokenService {

    private static final String SECRET_KEY = System.getenv().getOrDefault(
        "JWT_SECRET", "ChaveSecretaHmacCruelMarketLTDA2026_SegurancaTotal!"
    );

    private static final long TEMPO_EXPIRACAO_SEGUNDOS = 86400;

    public record DadosToken(String userId, String username, long expiraEm) {}

    public String gerarToken(Usuario usuario) {
        long expiraEm = Instant.now().getEpochSecond() + TEMPO_EXPIRACAO_SEGUNDOS;
        String payload = String.join(":",
                usuario.getId(),
                usuario.getUsername(),
                String.valueOf(expiraEm)
        );

        String payloadBase64 = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        String assinatura = assinarHmac(payloadBase64);

        return payloadBase64 + "." + assinatura;
    }

    public DadosToken validarToken(String token) {
        if (token == null || token.isBlank() || !token.contains(".")) {
            return null;
        }

        String[] partes = token.split("\\.");
        if (partes.length != 2) {
            return null;
        }

        String payloadBase64 = partes[0];
        String assinaturaRecebida = partes[1];
        String assinaturaCalculada = assinarHmac(payloadBase64);

        boolean assinaturaValida = MessageDigest.isEqual(
                assinaturaRecebida.getBytes(StandardCharsets.UTF_8),
                assinaturaCalculada.getBytes(StandardCharsets.UTF_8)
        );

        if (!assinaturaValida) {
            return null;
        }

        try {
            String payload = new String(Base64.getUrlDecoder().decode(payloadBase64), StandardCharsets.UTF_8);
            String[] campos = payload.split(":");
            if (campos.length != 3) {
                return null;
            }

            String userId = campos[0];
            String username = campos[1];
            long expiraEm = Long.parseLong(campos[2]);

            if (Instant.now().getEpochSecond() > expiraEm) {
                return null;
            }

            return new DadosToken(userId, username, expiraEm);
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
            throw new IllegalStateException("Falha ao assinar token", e);
        }
    }
}
