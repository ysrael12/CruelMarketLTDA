package com.bolsa.npcs;

import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;

//Adicionado para teste e verificação do comportamento de forma mais prática
class AgenteNPCTest {

    private final AtivoInfo gdhd = new AtivoInfo("GDHD", "CICLO", 30, 90);
    private final AgenteNPC ciclista = new AgenteNPC("npc_ciclista", PerfilNPC.CICLISTA, new Random(42));

    @Test
    void ciclistaCompraPertoDoPiso() {
        Ordem ordem = ciclista.decidir(gdhd, 32.0);
        assertNotNull(ordem);
        assertEquals("COMPRA", ordem.lado());
    }

    @Test
    void ciclistaVendePertoDoTeto() {
        Ordem ordem = ciclista.decidir(gdhd, 88.0);
        assertNotNull(ordem);
        assertEquals("VENDA", ordem.lado());
    }

    @Test
    void ciclistaNaoOperaNoMeioDaFaixa() {
        assertNull(ciclista.decidir(gdhd, 60.0));
    }

    @Test
    void precoDaOrdemFicaDentroDaFaixa() {
        Ordem ordem = ciclista.decidir(gdhd, 95.0); 
        assertEquals(90.0, ordem.preco());
    }

    @Test
    void mensagemNoFormatoDoMotor() {
        Ordem ordem = new Ordem("COMPRA", "GDHD", 2, 31.5);
        assertEquals("npc_ciclista:COMPRA GDHD 2 31.50", ordem.paraMensagem("npc_ciclista"));
    }

    @Test
    void cadaPerfilOperaSeuTipoDeAtivo() {
        assertTrue(ciclista.operaEm(gdhd));
        assertFalse(ciclista.operaEm(new AtivoInfo("CRUS", "BLUECHIP", 90, 150)));
    }
}
