import { Module } from "@nestjs/common";
import { PUBLICADOR_PRECO } from "../domain/ports/PublicadorPreco";
import { Particoes } from "./particoes";
import { RabbitConexao } from "./rabbit.conexao";
import { RabbitPublicadorPreco } from "./rabbit.publicador-preco";

/** Infraestrutura de mensageria: conexão, partições e publicação de `price.updated`. */
@Module({
    providers: [
        Particoes,
        RabbitConexao,
        RabbitPublicadorPreco,
        { provide: PUBLICADOR_PRECO, useExisting: RabbitPublicadorPreco },
    ],
    exports: [PUBLICADOR_PRECO, Particoes, RabbitConexao],
})
export class BrokerModule {}
