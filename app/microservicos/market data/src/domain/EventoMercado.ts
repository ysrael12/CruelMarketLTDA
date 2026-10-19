import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Ativo } from "./Ativo";

export enum TipoEvento {
    FRENZY = "FRENZY",
    SHORT_SQUEEZE = "SHORT_SQUEEZE",
    CRASH = "CRASH",
    DEMANDA_ALTA = "DEMANDA_ALTA",
    DEMANDA_BAIXA = "DEMANDA_BAIXA",
    FALENCIA_FATAL = "FALENCIA_FATAL",
}

@Entity()
export class EventoMercado {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "simple-enum", enum: TipoEvento })
    tipo: TipoEvento;

    @Column({ nullable: true })
    ticker: string | null;

    @ManyToOne(() => Ativo, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "ticker" })
    ativo: Ativo | null;

    @Column("datetime")
    anunciadoEm: Date;

    @Column("datetime")
    inicio: Date;

    @Column("datetime")
    fim: Date;

    estaVigente(agora: Date): boolean {
        return agora >= this.inicio && agora <= this.fim;
    }
}