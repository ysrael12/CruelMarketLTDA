import { describe, expect, test } from "bun:test";
import { Particoes, chaveRoteamento, hashJava, limparAtivo, particaoDe } from "./particoes";

describe("partições do mercado", () => {
    test("reproduz o String.hashCode do Java", () => {
        expect(hashJava("crus")).toBe(3_062_605);
        expect(hashJava("")).toBe(0);
    });

    test("normaliza o ticker como Particoes.limpar do Java", () => {
        expect(limparAtivo("CRUS")).toBe("crus");
        expect(limparAtivo(" crus!! ")).toBe("crus");
        expect(limparAtivo("AÇÃO-3")).toBe("ao-3");
        expect(limparAtivo("")).toBe("desconhecido");
        expect(limparAtivo(null)).toBe("desconhecido");
        expect(limparAtivo("!!!")).toBe("desconhecido");
    });

    test("gera a routing key do contrato price.updated.p{N}.{ativo}", () => {
        expect(chaveRoteamento("price.updated", "CRUS", 4)).toBe("price.updated.p1.crus");
        expect(chaveRoteamento("trade.executed", "GDHD", 4)).toBe("trade.executed.p1.gdhd");
        expect(chaveRoteamento("price.updated", "AÇÃO-3", 4)).toBe("price.updated.p0.ao-3");
    });

    test("mantém a partição em [0, total) mesmo com hash negativo", () => {
        const ticker = "zzzzzzzzzz";

        expect(hashJava(ticker)).toBeLessThan(0);
        expect(particaoDe(ticker, 4)).toBeGreaterThanOrEqual(0);
        expect(particaoDe(ticker, 4)).toBeLessThan(4);
        expect(particaoDe(ticker, 7)).toBeLessThan(7);
    });

    test("Particoes usa PARTICOES do ambiente e valida o valor", () => {
        const anterior = process.env.PARTICOES;
        try {
            process.env.PARTICOES = "8";
            const particoes = new Particoes();
            expect(particoes.total).toBe(8);
            expect(particoes.chave("price.updated", "CRUS")).toBe("price.updated.p5.crus");

            process.env.PARTICOES = "0";
            expect(() => new Particoes()).toThrow(/PARTICOES/);
        } finally {
            if (anterior === undefined) {
                delete process.env.PARTICOES;
            } else {
                process.env.PARTICOES = anterior;
            }
        }
    });
});
