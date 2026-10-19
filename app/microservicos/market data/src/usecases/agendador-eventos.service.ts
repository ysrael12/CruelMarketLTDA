import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { TipoEvento } from "../domain/EventoMercado";
import type { Ativo } from "../domain/Ativo";
import type { EventoMercado } from "../domain/EventoMercado";
import { ATIVO_REPOSITORY } from "../domain/ports/AtivoRepository";
import type { AtivoRepository } from "../domain/ports/AtivoRepository";
import { EVENTO_MERCADO_REPOSITORY } from "../domain/ports/EventoMercadoRepository";
import type { EventoMercadoRepository } from "../domain/ports/EventoMercadoRepository";
import { GeradorEventos } from "../domain/services/GeradorEventos";
import { AplicarEventoUseCase } from "./AplicarEventoUseCase";

/**
 * Agenda os eventos de mercado e entrega cada um ao `AplicarEventoUseCase`.
 *
 * - evento regular: sorteado a cada 45–90 s, gravado no anúncio e aplicado após o briefing;
 * - falência: agendada uma única vez por sessão e persistida antes do disparo, para não
 *   se repetir nem se perder quando o serviço cai (RNF10).
 */
@Injectable()
export class AgendadorEventos implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly logger = new Logger(AgendadorEventos.name);
    private readonly timers = new Set<NodeJS.Timeout>();
    private encerrado = false;

    constructor(
        @Inject(ATIVO_REPOSITORY)
        private readonly ativos: AtivoRepository,
        @Inject(EVENTO_MERCADO_REPOSITORY)
        private readonly eventos: EventoMercadoRepository,
        private readonly aplicar: AplicarEventoUseCase,
        private readonly gerador: GeradorEventos,
    ) {}

    async onApplicationBootstrap(): Promise<void> {
        if (process.env.EVENTOS_ENABLED === "false") {
            this.logger.warn("gerador de eventos desativado por EVENTOS_ENABLED=false");
            return;
        }

        await this.iniciar();
    }

    onApplicationShutdown(): void {
        this.encerrado = true;
        for (const timer of this.timers) {
            clearTimeout(timer);
        }
        this.timers.clear();
    }

    /** Separado do bootstrap para poder ser exercitado nos testes. */
    async iniciar(): Promise<void> {
        try {
            const ativos = await this.ativosAtivos();
            if (ativos.length === 0) {
                this.logger.warn("nenhum ativo ativo: gerador de eventos não iniciado");
                return;
            }

            await this.retomarAgendamentos();
            await this.agendarFalencia(ativos);
            this.agendarProximoRegular();
        } catch (erro) {
            this.logger.error(`falha ao iniciar o gerador de eventos: ${motivo(erro)}`);
        }
    }

    /** Reagenda o que já estava persistido com início no futuro (RNF10). */
    private async retomarAgendamentos(): Promise<void> {
        const futuros = await this.eventos.buscarFuturos(new Date());

        for (const evento of futuros) {
            this.agendar(evento);
        }

        if (futuros.length > 0) {
            this.logger.log(`retomou ${futuros.length} evento(s) já agendado(s)`);
        }
    }

    private async agendarFalencia(ativos: Ativo[]): Promise<void> {
        if ((await this.eventos.contarPorTipo(TipoEvento.FALENCIA_FATAL)) > 0) {
            return;
        }

        const candidatos = ativos.filter((ativo) => ativo.podeFalir);
        if (candidatos.length === 0) {
            return;
        }

        const evento = this.gerador.criarFalencia(candidatos, new Date());
        await this.eventos.salvar(evento);
        this.agendar(evento);
        this.logger.log(
            `EVENT_SCHEDULED evento=${evento.id} tipo=${evento.tipo} ticker=${evento.ticker} inicio=${evento.inicio.toISOString()}`,
        );
    }

    private agendarProximoRegular(): void {
        if (this.encerrado) {
            return;
        }

        const espera = this.gerador.proximoIntervaloMs();
        this.agendarTimer(espera, async () => {
            const alvos = await this.ativosAtivos();
            if (alvos.length > 0) {
                const evento = this.gerador.criarRegular(alvos, new Date());
                await this.eventos.salvar(evento);
                this.agendar(evento);
                this.logger.log(
                    `EVENT_ANNOUNCED evento=${evento.id} tipo=${evento.tipo} ticker=${evento.ticker} inicio=${evento.inicio.toISOString()}`,
                );
            }

            this.agendarProximoRegular();
        });
    }

    private agendar(evento: EventoMercado): void {
        const espera = Math.max(0, evento.inicio.getTime() - Date.now());

        this.agendarTimer(espera, async () => {
            await this.aplicar.executar(evento);
        });
    }

    private agendarTimer(espera: number, acao: () => Promise<void>): void {
        if (this.encerrado) {
            return;
        }

        const timer = setTimeout(() => {
            this.timers.delete(timer);
            void acao().catch((erro) => this.logger.error(`falha no evento: ${motivo(erro)}`));
        }, espera);

        this.timers.add(timer);
    }

    private async ativosAtivos(): Promise<Ativo[]> {
        return (await this.ativos.listar()).filter((ativo) => ativo.estaAtivo());
    }
}

function motivo(erro: unknown): string {
    return erro instanceof Error ? erro.message : String(erro);
}
