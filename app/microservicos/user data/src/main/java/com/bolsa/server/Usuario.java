package com.bolsa.server;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "usuarios")
public class Usuario {

    public enum StatusConta {
        ATIVA,
        BLOQUEADA
    }

    @Id
    @Column(name = "id", length = 36, nullable = false, updatable = false)
    private String id;

    @Column(name = "username", unique = true, nullable = false, length = 50)
    private String username;

    @Column(name = "senha_hash", nullable = false)
    private String senhaHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private StatusConta status;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    public Usuario() {
    }

    public Usuario(String username, String senhaHash) {
        this.id = UUID.randomUUID().toString();
        this.username = username;
        this.senhaHash = senhaHash;
        this.status = StatusConta.ATIVA;
        this.criadoEm = Instant.now();
    }

    public String getId() { return id; }
    public String getUsername() { return username; }
    public String getSenhaHash() { return senhaHash; }
    public void setSenhaHash(String senhaHash) { this.senhaHash = senhaHash; }
    public StatusConta getStatus() { return status; }
    public void setStatus(StatusConta status) { this.status = status; }
    public Instant getCriadoEm() { return criadoEm; }
}
