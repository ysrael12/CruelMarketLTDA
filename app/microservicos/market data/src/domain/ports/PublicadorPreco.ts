/** Token de injeção do adaptador de publicação de preços no broker. */
export const PUBLICADOR_PRECO = Symbol("PublicadorPreco");

export interface EventoPreco {
    ativo: string;
    preco: number;
    timestamp: number;
}

export interface PublicadorPreco {
    publicar(evento: EventoPreco): Promise<void>;
}
