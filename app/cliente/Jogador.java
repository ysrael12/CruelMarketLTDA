import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.util.concurrent.CompletionStage;

public class Jogador {

    private WebSocket webSocket;

    public void conectar(String userId) throws Exception {
        String url = "ws://localhost:8080/ws?userId=" + userId;

        this.webSocket = HttpClient.newHttpClient()
            .newWebSocketBuilder()
            .buildAsync(URI.create(url), new WebSocket.Listener() {

                @Override
                public void onOpen(WebSocket ws) {
                    System.out.println("[JOGADOR] Conectado");
                    ws.request(1);
                }

                @Override
                public CompletionStage<?> onText(WebSocket ws, CharSequence data, boolean last) {
                    System.out.println("[JOGADOR] Recebido: " + data);
                    ws.request(1);
                    return null;
                }

                @Override
                public CompletionStage<?> onClose(WebSocket ws, int code, String reason) {
                    System.out.println("[JOGADOR] Fechado: " + reason);
                    return null;
                }

                @Override
                public void onError(WebSocket ws, Throwable error) {
                    System.err.println("[JOGADOR] Erro: " + error.getMessage());
                }
            })
            .join();
        Thread.sleep(300);
    }
    public void enviar(String json) {
        webSocket.sendText(json, true);
    }
    public void fechar() {
        webSocket.sendClose(WebSocket.NORMAL_CLOSURE, "tchau");
    }

    public static void main(String[] args) throws Exception {
        Jogador jogador = new Jogador();
        jogador.conectar("teste");
        jogador.enviar("{tipo:teste}");
        Thread.sleep(5_000);
        jogador.fechar();
    }
}