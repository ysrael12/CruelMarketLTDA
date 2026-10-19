import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { Ativo } from "../domain/Ativo";
import type { AtivoRepository } from "../domain/ports/AtivoRepository";

@Injectable()
export class TypeOrmAtivoRepository implements AtivoRepository {
    constructor(
        @InjectRepository(Ativo)
        private readonly repositorio: Repository<Ativo>,
    ) {}

    async salvar(ativo: Ativo): Promise<void> {
        await this.repositorio.save(ativo);
    }

    async buscarPorTicker(ticker: string): Promise<Ativo | null> {
        return this.repositorio.findOneBy({ ticker });
    }

    async listar(): Promise<Ativo[]> {
        return this.repositorio.find({ order: { ticker: "ASC" } });
    }
}
