package com.bolsa.npcs;

/** Perfis de NPC definidos no RF16. */
public enum PerfilNPC {
    CICLISTA,     // compra perto do piso e vende perto do teto (ativos de perfil CICLO)
    ALEATORIO,    // lado e preco sorteados perto do preco atual (ativos RANDOM_WALK)
    CONSERVADOR   // so opera o bluechip, raramente e perto do preco
}
