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

    @Column({ default: "" })
    descricao: string;

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

    /** Nulo enquanto o ativo ainda não teve nenhuma negociação. */
    @Column("decimal", { precision: 12, scale: 2, nullable: true })
    ultimoPreco: number | null;

    @Column({ type: "simple-enum", enum: StatusAtivo, default: StatusAtivo.ATIVO })
    status: StatusAtivo;

    /** Fase do ciclo em [0,1): 0 = centro, 0,25 = teto, 0,5 = centro, 0,75 = piso. */
    @Column("float", { default: 0 })
    faseCiclo: number;

    /** Duração de um ciclo completo (subida + descida); nulo usa o padrão da política. */
    @Column("float", { nullable: true })
    cicloSegundos: number | null;

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

    /** Preço mostrado ao jogador: o do último negócio; sem negócio, o de referência. */
    precoExibido(): number {
        return this.ultimoPreco ?? this.precoReferencia;
    }

    atualizarPrecoReferencia(preco: number): void {
        this.precoReferencia = this.limitarAoIntervalo(preco);
    }

    atualizarUltimoPreco(preco: number): void {
        this.ultimoPreco = this.limitarAoIntervalo(preco);
    }

    atualizarFaseCiclo(fase: number): void {
        this.faseCiclo = ((fase % 1) + 1) % 1;
    }

    private limitarAoIntervalo(preco: number): number {
        const limitado = Math.min(this.teto, Math.max(this.piso, preco));
        return Math.round(limitado * 100) / 100;
    }
}