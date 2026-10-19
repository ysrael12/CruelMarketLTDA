import { Injectable, Logger } from "@nestjs/common";
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { ExecutarTickUseCase } from "./ExecutarTickUseCase";

const TICK_MS_PADRAO = 1000;
const INTERVALO_ENTRE_LOGS_MS = 60_000;

/** Dispara o `ExecutarTickUseCase` a cada `TICK_MS`, sem sobrepor execuções. */
@Injectable()
export class AgendadorTick implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly logger = new Logger(AgendadorTick.name);
    private temporizador?: NodeJS.Timeout;
    private executando = false;
    private ultimaFalha?: { motivo: string; em: number };

    constructor(private readonly executarTick: ExecutarTickUseCase) {}

    onApplicationBootstrap(): void {
        if (process.env.TICK_ENABLED === "false") {
            this.logger.warn("tick desativado por TICK_ENABLED=false");
            return;
        }

        const intervalo = this.intervalo();
        this.temporizador = setInterval(() => void this.ciclo(), intervalo);
        this.logger.log(`tick do mercado a cada ${intervalo} ms`);
    }

    onApplicationShutdown(): void {
        if (this.temporizador) {
            clearInterval(this.temporizador);
            this.temporizador = undefined;
        }
    }

    private async ciclo(): Promise<void> {
        if (this.executando) {
            this.logger.warn("tick anterior ainda em andamento; pulando este");
            return;
        }

        this.executando = true;
        try {
            await this.executarTick.executar();
            this.ultimaFalha = undefined;
        } catch (erro) {
            this.registrarFalha(erro instanceof Error ? erro.message : String(erro));
        } finally {
            this.executando = false;
        }
    }

    /** Não repete o mesmo erro a cada tick: loga na primeira vez e depois a cada minuto. */
    private registrarFalha(motivo: string): void {
        const agora = Date.now();
        const repetido =
            this.ultimaFalha?.motivo === motivo && agora - this.ultimaFalha.em < INTERVALO_ENTRE_LOGS_MS;

        if (repetido) {
            return;
        }

        this.ultimaFalha = { motivo, em: agora };
        this.logger.error(`falha no tick: ${motivo}`);
    }

    private intervalo(): number {
        const configurado = process.env.TICK_MS;
        if (configurado === undefined || configurado.trim() === "") {
            return TICK_MS_PADRAO;
        }

        const intervalo = Number(configurado);
        if (!Number.isFinite(intervalo) || intervalo <= 0) {
            throw new Error(`TICK_MS deve ser numérico e positivo, recebido: ${configurado}`);
        }
        return intervalo;
    }
}
