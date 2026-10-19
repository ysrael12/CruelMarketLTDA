import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Categoria, PerfilPreco } from "../domain/Ativo";

export interface AtivoConfig {
    ticker: string;
    nome: string;
    descricao?: string;
    categoria: Categoria;
    perfil: PerfilPreco;
    piso: number;
    teto: number;
    precoReferencia: number;
    podeFalir: boolean;
    mensagemGameOver?: string;
    /** Duração do ciclo completo em segundos (20 a 60, RF04). */
    cicloSegundos?: number;
}

export const CAMINHO_ATIVOS_PADRAO = "config/ativos.json";

/** Lê o catálogo de ativos de um arquivo JSON (RNF08: parâmetros sem recompilar). */
export function lerAtivosConfig(
    caminho = process.env.CONFIG_PATH ?? CAMINHO_ATIVOS_PADRAO,
): AtivoConfig[] {
    const absoluto = resolve(caminho);
    const conteudo = JSON.parse(readFileSync(absoluto, "utf8")) as { ativos?: unknown };

    if (!Array.isArray(conteudo.ativos)) {
        throw new Error(`Configuração inválida em ${absoluto}: esperava a lista "ativos"`);
    }

    const ativos = conteudo.ativos.map((item, indice) => validarAtivo(item, indice, absoluto));
    const tickers = new Set<string>();
    for (const ativo of ativos) {
        if (tickers.has(ativo.ticker)) {
            throw new Error(`Ticker duplicado em ${absoluto}: ${ativo.ticker}`);
        }
        tickers.add(ativo.ticker);
    }

    return ativos;
}

function validarAtivo(item: unknown, indice: number, origem: string): AtivoConfig {
    const bruto = item as Partial<AtivoConfig>;
    const erro = (motivo: string) =>
        new Error(`Ativo #${indice + 1} inválido em ${origem}: ${motivo}`);

    if (typeof bruto.ticker !== "string" || !bruto.ticker.trim()) {
        throw erro("ticker obrigatório");
    }
    if (typeof bruto.nome !== "string" || !bruto.nome.trim()) {
        throw erro("nome obrigatório");
    }
    if (!Object.values(Categoria).includes(bruto.categoria as Categoria)) {
        throw erro(`categoria deve ser uma de ${Object.values(Categoria).join(", ")}`);
    }
    if (!Object.values(PerfilPreco).includes(bruto.perfil as PerfilPreco)) {
        throw erro(`perfil deve ser um de ${Object.values(PerfilPreco).join(", ")}`);
    }
    for (const campo of ["piso", "teto", "precoReferencia"] as const) {
        if (typeof bruto[campo] !== "number" || !Number.isFinite(bruto[campo])) {
            throw erro(`${campo} deve ser numérico`);
        }
    }
    if (bruto.piso! <= 0) {
        throw erro("piso deve ser maior que zero");
    }
    if (bruto.teto! < bruto.piso!) {
        throw erro("teto deve ser maior ou igual ao piso");
    }
    if (bruto.precoReferencia! < bruto.piso! || bruto.precoReferencia! > bruto.teto!) {
        throw erro("precoReferencia deve estar entre piso e teto");
    }

    const podeFalir = bruto.podeFalir === true;
    const mensagemGameOver = typeof bruto.mensagemGameOver === "string" ? bruto.mensagemGameOver : "";
    if (podeFalir && !mensagemGameOver.trim()) {
        throw erro("ativo que pode falir precisa de mensagemGameOver (RF23)");
    }

    const cicloSegundos = bruto.cicloSegundos;
    if (cicloSegundos !== undefined) {
        if (typeof cicloSegundos !== "number" || !Number.isFinite(cicloSegundos)) {
            throw erro("cicloSegundos deve ser numérico");
        }
        if (cicloSegundos < 20 || cicloSegundos > 60) {
            throw erro("cicloSegundos deve estar entre 20 e 60 (RF04)");
        }
    }

    return {
        ticker: bruto.ticker.toUpperCase(),
        nome: bruto.nome,
        descricao: typeof bruto.descricao === "string" ? bruto.descricao : "",
        categoria: bruto.categoria as Categoria,
        perfil: bruto.perfil as PerfilPreco,
        piso: bruto.piso!,
        teto: bruto.teto!,
        precoReferencia: bruto.precoReferencia!,
        podeFalir,
        mensagemGameOver,
        cicloSegundos,
    };
}
