import { Injectable, Logger } from "@nestjs/common";
import type { PublicadorPreco, EventoPreco } from "../domain/ports/PublicadorPreco";
import { EXCHANGE_EVENTOS, PRICE_UPDATED } from "./nomes";
import { Particoes } from "./particoes";
import { RabbitConexao } from "./rabbit.conexao";

@Injectable()
export class RabbitPublicadorPreco implements PublicadorPreco {
    private readonly logger = new Logger(RabbitPublicadorPreco.name);
    private ultimoEstado?: boolean;

    constructor(
        private readonly conexao: RabbitConexao,
        private readonly particoes: Particoes,
    ) {}

    disponivel(): boolean {
        const conectado = this.conexao.estaConectado();

        if (conectado !== this.ultimoEstado) {
            if (conectado) {
                this.logger.log("RabbitMQ conectado: publicação de preços retomada");
            } else {
                this.logger.warn("RabbitMQ offline: preços serão atualizados sem publicação");
            }
            this.ultimoEstado = conectado;
        }

        return conectado;
    }

    /**
     * Publica `price.updated` na exchange `cruel.eventos`, com a routing key
     * `price.updated.p{N}.{ativo}` que o gateway já assina (`price.updated.*.*`).
     */
    async publicar(evento: EventoPreco): Promise<void> {
        const canal = this.conexao.canalAtual();
        const chave = this.particoes.chave(PRICE_UPDATED, evento.ativo);

        const publicado = canal.publish(
            EXCHANGE_EVENTOS,
            chave,
            Buffer.from(JSON.stringify(evento)),
            {
                contentType: "application/json",
                persistent: true,
                messageId: `${evento.ativo}-${evento.sequencia}`,
                timestamp: Math.floor(evento.timestamp / 1000),
            },
        );

        if (!publicado) {
            await new Promise<void>((resolver) => canal.once("drain", () => resolver()));
        }
    }
}
