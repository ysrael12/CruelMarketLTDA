import { Inject, Injectable, Logger, OnApplicationBootstrap, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Ativo, StatusAtivo } from "../domain/Ativo";
import type { AtivoConfig } from "./ativos.config";
import { lerAtivosConfig } from "./ativos.config";

/** Token de injeção do catálogo carregado da configuração. */
export const ATIVOS_CONFIG = Symbol("AtivosConfig");

@Injectable()
export class SeedService implements OnApplicationBootstrap {
    private readonly logger = new Logger(SeedService.name);

    constructor(
        @InjectRepository(Ativo) private readonly ativos: Repository<Ativo>,
        @Optional() @Inject(ATIVOS_CONFIG) private readonly config: AtivoConfig[] | null = null,
    ) {}

    async onApplicationBootstrap(): Promise<void> {
        if (process.env.SEED_ON_STARTUP === "false") {
            return;
        }

        const criados = await this.semear(this.config ?? lerAtivosConfig());
        if (criados.length > 0) {
            this.logger.log(`Ativos criados a partir da configuração: ${criados.join(", ")}`);
        }
    }

    /** Cria apenas os ativos ausentes, preservando o estado atual do mercado. */
    async semear(configs: AtivoConfig[]): Promise<string[]> {
        const criados: string[] = [];
        for (const config of configs) {
            const existente = await this.ativos.findOneBy({ ticker: config.ticker });
            if (existente) {
                continue;
            }
            await this.ativos.save(this.novoAtivo(config));
            criados.push(config.ticker);
        }
        return criados;
    }

    private novoAtivo(config: AtivoConfig): Ativo {
        return Object.assign(new Ativo(), {
            ticker: config.ticker,
            nome: config.nome,
            descricao: config.descricao ?? "",
            categoria: config.categoria,
            perfil: config.perfil,
            piso: config.piso,
            teto: config.teto,
            precoReferencia: config.precoReferencia,
            ultimoPreco: null,
            status: StatusAtivo.ATIVO,
            faseCiclo: 0,
            cicloSegundos: config.cicloSegundos ?? null,
            podeFalir: config.podeFalir,
            mensagemGameOver: config.mensagemGameOver ?? "",
        });
    }
}
