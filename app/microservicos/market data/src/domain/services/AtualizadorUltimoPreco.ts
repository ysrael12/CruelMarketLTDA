import { Ativo, StatusAtivo } from "../Ativo";
import { Negociacao } from "../Negociacao";

/** Toda negociação executada passa a ser o último preço do ativo. */
export class AtualizadorUltimoPreco {
    aplicar(ativo: Ativo, negociacao: Negociacao): void {
        if (negociacao.ticker !== ativo.ticker) {
            throw new Error(
                `Negociação do ativo ${negociacao.ticker} não pode atualizar ${ativo.ticker}`,
            );
        }
        if (ativo.status === StatusAtivo.FALIDO) {
            return;
        }

        ativo.atualizarUltimoPreco(negociacao.preco);
    }
}
