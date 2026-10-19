import { Injectable } from "@nestjs/common";

/**
 * Sequência global de preços publicados: o cliente usa para detectar eventos perdidos.
 * Em memória, recomeça em 1 a cada boot.
 */
@Injectable()
export class SequenciaMercado {
    private ultima = 0;

    proxima(): number {
        this.ultima += 1;
        return this.ultima;
    }
}
