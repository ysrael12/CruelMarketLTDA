/** Token de injeção do adaptador de publicação de preços no broker. */
export const PUBLICADOR_PRECO = Symbol("PublicadorPreco");

/** Origem do preço publicado: tick do relógio ou negociação executada. */
export enum OrigemPreco {
    TICK = "TICK",
    NEGOCIO = "NEGOCIO",
}

export interface EventoPreco {
    ativo: string;
    /** Preço a exibir: o do último negócio; sem negócio, o de referência. */
    preco: number;
    origem: OrigemPreco;
    /** Sequência global para o cliente detectar perdas. */
    sequencia: number;
    timestamp: number;
}

export interface PublicadorPreco {
    publicar(evento: EventoPreco): Promise<void>;
}
