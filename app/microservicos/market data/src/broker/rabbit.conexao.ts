import { Injectable, Logger } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { connect } from "amqplib";
import type { Channel, ChannelModel, RecoveringChannelModel } from "amqplib";

const URL_PADRAO = "amqp://guest:guest@localhost:5672";

export type PreparadorCanal = (canal: Channel) => Promise<void>;

/**
 * Conexão única com o RabbitMQ. Usa a recuperação automática do amqplib 2.x: a cada
 * (re)conexão o canal é recriado e os preparadores rodam de novo, então consumidores
 * e declarations voltam sozinhos depois de uma queda do broker.
 *
 * A primeira conexão roda em background: o serviço sobe mesmo sem RabbitMQ e, nesse
 * caso, a publicação falha com erro em vez de bloquear o tick.
 */
@Injectable()
export class RabbitConexao implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(RabbitConexao.name);
    private readonly preparadores: PreparadorCanal[] = [];
    private modelo?: RecoveringChannelModel;
    private canal?: Channel;

    /**
     * Registrar no construtor do provider garante que o preparador existe antes do
     * `onModuleInit` desta conexão disparar a primeira conexão.
     */
    registrarPreparador(preparador: PreparadorCanal): void {
        this.preparadores.push(preparador);
    }

    estaConectado(): boolean {
        return this.canal !== undefined;
    }

    canalAtual(): Channel {
        if (!this.canal) {
            throw new Error("RabbitMQ indisponível: nenhum canal aberto");
        }
        return this.canal;
    }

    onModuleInit(): void {
        void this.conectar();
    }

    async onModuleDestroy(): Promise<void> {
        try {
            await this.modelo?.close();
        } catch (erro) {
            this.logger.warn(`falha ao fechar a conexão: ${mensagem(erro)}`);
        }
        this.canal = undefined;
    }

    private async conectar(): Promise<void> {
        const url = process.env.RABBITMQ_URL ?? URL_PADRAO;

        try {
            this.modelo = await connect(url, {
                recovery: {
                    waitForConnect: false,
                    initialDelay: 1000,
                    maxDelay: 30_000,
                    factor: 2,
                    setup: (modelo: ChannelModel) => this.prepararCanal(modelo),
                },
            });
        } catch (erro) {
            this.logger.error(`não foi possível iniciar a conexão com ${url}: ${mensagem(erro)}`);
            return;
        }

        this.modelo.on("connect", () => this.logger.log(`conectado ao RabbitMQ em ${url}`));
        this.modelo.on("disconnect", (erro) => this.logger.warn(`desconectado: ${mensagem(erro)}`));
        this.modelo.on("connect-failed", (erro) =>
            this.logger.warn(`nova tentativa em andamento: ${mensagem(erro)}`),
        );
        this.modelo.on("reconnect-failed", (erro) =>
            this.logger.error(`desisti de reconectar: ${mensagem(erro)}`),
        );
    }

    private async prepararCanal(modelo: ChannelModel): Promise<void> {
        const canal = await modelo.createChannel();
        canal.on("error", (erro) => this.logger.error(`erro no canal: ${mensagem(erro)}`));

        for (const preparador of this.preparadores) {
            await preparador(canal);
        }

        this.canal = canal;
    }
}

function mensagem(erro: unknown): string {
    if (erro instanceof Error && erro.message !== "") {
        return erro.message;
    }
    const codigo = (erro as { code?: string } | undefined)?.code;
    return codigo ?? String(erro);
}
