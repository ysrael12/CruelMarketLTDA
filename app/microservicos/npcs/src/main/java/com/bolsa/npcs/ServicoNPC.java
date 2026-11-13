package com.bolsa.npcs;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.amqp.core.ExchangeTypes;
import org.springframework.amqp.rabbit.annotation.Exchange;
import org.springframework.amqp.rabbit.annotation.Queue;
import org.springframework.amqp.rabbit.annotation.QueueBinding;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Liga os agentes ao resto do sistema, apenas pelo RabbitMQ:
 * escuta os precos do Market Data e publica ordens na mesma fila usada pelos jogadores.
 */
@Component
public class ServicoNPC {

    // Parametros da planilha: abaixo de R$ 1 o ativo e tratado como falido.
    private static final double LIMIAR_FALENCIA = 1.0;
    private static final String FILA_ORDENS = "ordens.fila";

    private final RabbitTemplate rabbit;
    private final Random random = new Random();
    private final Map<String, AtivoInfo> ativos;
    private final List<AgenteNPC> agentes;
    private final Map<String, Double> precos = new ConcurrentHashMap<>();
    private final boolean enviar;

    public ServicoNPC(RabbitTemplate rabbit,
                      @Value("${npc.ativos}") String configAtivos,
                      @Value("${npc.agentes}") String configAgentes,
                      @Value("${npc.enviar:true}") boolean enviar) {
        this.rabbit = rabbit;
        this.enviar = enviar;
        this.ativos = lerAtivos(configAtivos);
        this.agentes = lerAgentes(configAgentes);
        System.out.println("[NPC] " + agentes.size() + " agentes e " + ativos.size() + " ativos configurados"
                + (enviar ? "" : " (modo simulacao: as ordens so aparecem no log)"));
    }

    /** Escuta: guarda o preco de referencia (origem TICK) de cada ativo. Decisao Q1: a referencia ancora os NPCs. */
    @RabbitListener(bindings = @QueueBinding(
            value = @Queue(value = "", durable = "false", exclusive = "true", autoDelete = "true"),
            exchange = @Exchange(value = "cruel.eventos", type = ExchangeTypes.TOPIC),
            key = "price.updated.*.*"))
    public void receberPreco(EventoPreco evento) {
        if (evento == null || evento.ativo() == null) return;
        if ("TICK".equals(evento.origem())) {
            precos.put(evento.ativo().toUpperCase(), evento.preco());
        }
    }

    /** Age: a cada rodada, cada agente escolhe um ativo do seu perfil e talvez envia uma ordem. */
    @Scheduled(initialDelayString = "${npc.atraso-inicial-ms:10000}", fixedDelayString = "${npc.intervalo-ms:3000}")
    public void rodada() {
        for (AgenteNPC agente : agentes) {
            List<AtivoInfo> candidatos = new ArrayList<>();
            for (AtivoInfo ativo : ativos.values()) {
                Double preco = precos.get(ativo.ticker());
                if (preco != null && preco > LIMIAR_FALENCIA && agente.operaEm(ativo)) {
                    candidatos.add(ativo);
                }
            }
            if (candidatos.isEmpty()) continue; // ainda nao chegou preco desses ativos

            AtivoInfo escolhido = candidatos.get(random.nextInt(candidatos.size()));
            Ordem ordem = agente.decidir(escolhido, precos.get(escolhido.ticker()));
            if (ordem == null) continue;

            String mensagem = ordem.paraMensagem(agente.nome());
            if (enviar) {
                rabbit.convertAndSend(FILA_ORDENS, mensagem);
                System.out.println("[NPC] " + mensagem);
            } else {
                System.out.println("[NPC simulado] " + mensagem);
            }
        }
    }

    // Formato: TICKER:PERFIL_DO_ATIVO:PISO:TETO, separados por virgula.
    private static Map<String, AtivoInfo> lerAtivos(String config) {
        Map<String, AtivoInfo> mapa = new LinkedHashMap<>();
        for (String item : config.split(",")) {
            String[] p = item.trim().split(":");
            String ticker = p[0].trim().toUpperCase();
            mapa.put(ticker, new AtivoInfo(ticker, p[1].trim().toUpperCase(),
                    Double.parseDouble(p[2].trim()), Double.parseDouble(p[3].trim())));
        }
        return mapa;
    }

    // Formato: nome:PERFIL, separados por virgula. Nomes diferentes: o motor nao casa um usuario com ele mesmo.
    private List<AgenteNPC> lerAgentes(String config) {
        List<AgenteNPC> lista = new ArrayList<>();
        for (String item : config.split(",")) {
            String[] p = item.trim().split(":");
            lista.add(new AgenteNPC(p[0].trim(), PerfilNPC.valueOf(p[1].trim().toUpperCase()), random));
        }
        return lista;
    }
}
