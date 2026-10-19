import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { EventoMercado } from "../domain/EventoMercado";
import type { TipoEvento } from "../domain/EventoMercado";
import type { EventoMercadoRepository } from "../domain/ports/EventoMercadoRepository";

@Injectable()
export class TypeOrmEventoMercadoRepository implements EventoMercadoRepository {
    constructor(
        @InjectRepository(EventoMercado)
        private readonly repositorio: Repository<EventoMercado>,
    ) {}

    async salvar(evento: EventoMercado): Promise<void> {
        await this.repositorio.save(evento);
    }

    async buscarVigente(ticker: string, agora: Date): Promise<EventoMercado[]> {
        return this.repositorio
            .createQueryBuilder("evento")
            .where("evento.inicio <= :agora", { agora })
            .andWhere("evento.fim >= :agora", { agora })
            .andWhere("(evento.ticker = :ticker OR evento.ticker IS NULL)", { ticker })
            .orderBy("evento.inicio", "ASC")
            .getMany();
    }

    async listar(limite: number): Promise<EventoMercado[]> {
        return this.repositorio.find({
            order: { anunciadoEm: "DESC" },
            take: limite,
        });
    }

    async buscarFuturos(agora: Date): Promise<EventoMercado[]> {
        return this.repositorio
            .createQueryBuilder("evento")
            .where("evento.inicio > :agora", { agora })
            .orderBy("evento.inicio", "ASC")
            .getMany();
    }

    async contarPorTipo(tipo: TipoEvento): Promise<number> {
        return this.repositorio.countBy({ tipo });
    }
}
