import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Ativo } from "./Ativo";

@Entity()
@Index(["ticker", "executadaEm"])
export class Negociacao {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    ticker: string;

    @ManyToOne(() => Ativo, { nullable: false, onDelete: "RESTRICT" })
    @JoinColumn({ name: "ticker" })
    ativo: Ativo;

    @Column("uuid")
    ordemCompraId: string;

    @Column("uuid")
    ordemVendaId: string;

    @Column("int")
    quantidade: number;

    @Column("decimal", { precision: 12, scale: 2 })
    preco: number;

    @Column("datetime")
    executadaEm: Date;

    @Column("bigint")
    sequencia: number;
}