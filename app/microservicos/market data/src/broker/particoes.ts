import { Injectable } from "@nestjs/common";

export const PARTICOES_PADRAO = 4;

/**
 * Normaliza o ticker como `Particoes.limpar` do Java: minúsculas, só `[a-z0-9_-]`,
 * e `desconhecido` quando não sobra nada.
 */
export function limparAtivo(ativo: string | null | undefined): string {
    const limpo = (ativo ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    return limpo === "" ? "desconhecido" : limpo;
}

/** `String.hashCode()` do Java (32 bits com sinal) para bater a partição entre os serviços. */
export function hashJava(texto: string): number {
    let hash = 0;
    for (let i = 0; i < texto.length; i += 1) {
        hash = (Math.imul(31, hash) + texto.charCodeAt(i)) | 0;
    }
    return hash;
}

/** `Math.floorMod(hash, total)` do Java: sempre no intervalo [0, total). */
export function particaoDe(ativo: string | null | undefined, total = PARTICOES_PADRAO): number {
    const particoes = Math.max(1, Math.trunc(total));
    return ((hashJava(limparAtivo(ativo)) % particoes) + particoes) % particoes;
}

/** Routing key do contrato: `{evento}.p{N}.{ativo}`, ex.: `price.updated.p1.crus`. */
export function chaveRoteamento(
    evento: string,
    ativo: string | null | undefined,
    total = PARTICOES_PADRAO,
): string {
    return `${evento}.p${particaoDe(ativo, total)}.${limparAtivo(ativo)}`;
}

@Injectable()
export class Particoes {
    readonly total: number;

    constructor() {
        const configurado = process.env.PARTICOES;

        if (configurado === undefined || configurado.trim() === "") {
            this.total = PARTICOES_PADRAO;
            return;
        }

        const total = Number(configurado);
        if (!Number.isInteger(total) || total < 1) {
            throw new Error(`PARTICOES deve ser um inteiro positivo, recebido: ${configurado}`);
        }
        this.total = total;
    }

    de(ativo: string | null | undefined): number {
        return particaoDe(ativo, this.total);
    }

    chave(evento: string, ativo: string | null | undefined): string {
        return chaveRoteamento(evento, ativo, this.total);
    }

    filaEngine(particao: number): string {
        return `q.engine.p${particao}`;
    }
}
