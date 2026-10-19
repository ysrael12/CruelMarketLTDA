import { Column, Entity, PrimaryColumn } from "typeorm";

export enum Categoria {
    ACAO = "ACAO",
    PECA = "PECA",
    PEIXE = "PEIXE",
}

export enum PerfilPreco {
    BLUECHIP = "BLUECHIP",
    CICLO = "CICLO",
    RANDOM_WALK = "RANDOM_WALK",
    FIXO = "FIXO",
}

export enum StatusAtivo {
    ATIVO = "ATIVO",
    FALIDO = "FALIDO",
}

@Entity()
export class Ativo {
    @PrimaryColumn()
    ticker: string;

    @Column()
    nome: string;

    @Column({ type: "simple-enum", enum: Categoria })
    categoria: Categoria;

    @Column({ type: "simple-enum", enum: PerfilPreco })
    perfil: PerfilPreco;

    @Column("decimal", { precision: 12, scale: 2 })
    piso: number;

    @Column("decimal", { precision: 12, scale: 2 })
    teto: number;

    @Column("decimal", { precision: 12, scale: 2 })
    precoReferencia: number;

    @Column("decimal", { precision: 12, scale: 2 })
    ultimoPreco: number;

    @Column({ type: "simple-enum", enum: StatusAtivo, default: StatusAtivo.ATIVO })
    status: StatusAtivo;

    @Column({ default: false })
    podeFalir: boolean;

    @Column({ default: "" })
    mensagemGameOver: string;

    falir(): void {
        this.status = StatusAtivo.FALIDO;
    }

    estaAtivo(): boolean {
        return this.status === StatusAtivo.ATIVO;
    }

    atualizarPrecoReferencia(preco: number): void {
        this.precoReferencia = this.limitarAoIntervalo(preco);
    }

    atualizarUltimoPreco(preco: number): void {
        this.ultimoPreco = this.limitarAoIntervalo(preco);
    }

    private limitarAoIntervalo(preco: number): number {
        const limitado = Math.min(this.teto, Math.max(this.piso, preco));
        return Math.round(limitado * 100) / 100;
    }
}