import { Ativo } from "../Ativo";
import { PoliticaPreco, limitarAoIntervalo } from "./PoliticaPreco";

/** Preço constante: o tick apenas reafirma o preço de referência corrente. */
export class PoliticaFixo implements PoliticaPreco {
    proximoPreco(ativo: Ativo): number {
        return limitarAoIntervalo(ativo, ativo.precoReferencia);
    }
}
