import type { Ativo } from "../Ativo";
import { EventoMercado, TipoEvento } from "../EventoMercado";
import type { FonteAleatoria } from "./aleatorio";

/** Tipos sorteados no mercado; `FALENCIA_FATAL` é agendada uma única vez (RF12/RF20). */
export const TIPOS_REGULARES: readonly TipoEvento[] = [
    TipoEvento.FRENZY,
    TipoEvento.SHORT_SQUEEZE,
    TipoEvento.CRASH,
    TipoEvento.DEMANDA_ALTA,
    TipoEvento.DEMANDA_BAIXA,
];

export interface OpcoesGeradorEventos {
    aleatorio?: FonteAleatoria;
    /** Intervalo entre eventos regulares (RF12: 45–90 s). */
    intervaloMinMs?: number;
    intervaloMaxMs?: number;
    /** Antecedência do briefing (RF13: 5 s). */
    briefingMs?: number;
    /** Duração do efeito (RF12: 15–30 s). */
    duracaoMinMs?: number;
    duracaoMaxMs?: number;
    /** Janela da falência única da sessão (RF20: 2–5 min). */
    falenciaMinMs?: number;
    falenciaMaxMs?: number;
}

/**
 * Sorteia os eventos de mercado. Não guarda estado nem usa timer: recebe a data e
 * devolve o evento pronto, então o resultado é reproduzível com a mesma seed (RNF05).
 */
export class GeradorEventos {
    private readonly aleatorio: FonteAleatoria;
    private readonly intervaloMinMs: number;
    private readonly intervaloMaxMs: number;
    private readonly briefingMs: number;
    private readonly duracaoMinMs: number;
    private readonly duracaoMaxMs: number;
    private readonly falenciaMinMs: number;
    private readonly falenciaMaxMs: number;

    constructor(opcoes: OpcoesGeradorEventos = {}) {
        this.aleatorio = opcoes.aleatorio ?? Math.random;
        this.intervaloMinMs = opcoes.intervaloMinMs ?? 45_000;
        this.intervaloMaxMs = opcoes.intervaloMaxMs ?? 90_000;
        this.briefingMs = opcoes.briefingMs ?? 5_000;
        this.duracaoMinMs = opcoes.duracaoMinMs ?? 15_000;
        this.duracaoMaxMs = opcoes.duracaoMaxMs ?? 30_000;
        this.falenciaMinMs = opcoes.falenciaMinMs ?? 120_000;
        this.falenciaMaxMs = opcoes.falenciaMaxMs ?? 300_000;
    }

    /** Quanto esperar até o próximo evento regular. */
    proximoIntervaloMs(): number {
        return this.entre(this.intervaloMinMs, this.intervaloMaxMs);
    }

    /** Evento regular com briefing antes do efeito, mirando um dos ativos ativos. */
    criarRegular(alvos: Ativo[], agora: Date): EventoMercado {
        if (alvos.length === 0) {
            throw new Error("não há ativo ativo para receber o evento");
        }

        const alvo = alvos[this.sortearIndice(alvos.length)];
        const tipo = TIPOS_REGULARES[this.sortearIndice(TIPOS_REGULARES.length)];
        const inicio = new Date(agora.getTime() + this.briefingMs);

        return Object.assign(new EventoMercado(), {
            tipo,
            ticker: alvo.ticker,
            anunciadoEm: agora,
            inicio,
            fim: new Date(inicio.getTime() + this.entre(this.duracaoMinMs, this.duracaoMaxMs)),
        });
    }

    /** Falência única da sessão, agendada entre 2 e 5 min à frente (RF20). */
    criarFalencia(candidatos: Ativo[], agora: Date): EventoMercado {
        if (candidatos.length === 0) {
            throw new Error("não há ativo que possa falir");
        }

        const alvo = candidatos[this.sortearIndice(candidatos.length)];
        const inicio = new Date(agora.getTime() + this.entre(this.falenciaMinMs, this.falenciaMaxMs));

        return Object.assign(new EventoMercado(), {
            tipo: TipoEvento.FALENCIA_FATAL,
            ticker: alvo.ticker,
            anunciadoEm: new Date(inicio.getTime() - this.briefingMs),
            inicio,
            fim: inicio,
        });
    }

    /** Evento disparado por comando de administrador (RF22): efeito imediato, sem briefing. */
    criar(tipo: TipoEvento, ticker: string | null, agora: Date, duracaoMs?: number): EventoMercado {
        const duracao = duracaoMs ?? this.entre(this.duracaoMinMs, this.duracaoMaxMs);

        return Object.assign(new EventoMercado(), {
            tipo,
            ticker,
            anunciadoEm: agora,
            inicio: agora,
            fim: new Date(agora.getTime() + duracao),
        });
    }

    private entre(minimo: number, maximo: number): number {
        return minimo + this.aleatorio() * (maximo - minimo);
    }

    private sortearIndice(tamanho: number): number {
        return Math.min(tamanho - 1, Math.floor(this.aleatorio() * tamanho));
    }
}
