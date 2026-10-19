import { describe, expect, test } from 'bun:test';
import { BadRequestException } from '@nestjs/common';
import type { Negociacao } from '../domain/Negociacao';
import type { NegociacaoRepository } from '../domain/ports/NegociacaoRepository';
import {
  ConsultarHistoricoUseCase,
  LIMITE_HISTORICO_MAXIMO,
  LIMITE_HISTORICO_PADRAO,
} from './ConsultarHistoricoUseCase';

function criarRepositorioFalso(negociacoes: Negociacao[]) {
  const chamadas: Array<{ ticker: string; limite: number }> = [];
  const repositorio: NegociacaoRepository = {
    salvar: async () => {},
    listarPorTicker: async (ticker, limite) => {
      chamadas.push({ ticker, limite });
      return negociacoes.filter((negociacao) => negociacao.ticker === ticker).slice(0, limite);
    },
    volumePorTicker: async () => new Map(),
  };

  return { repositorio, chamadas };
}

const negociacoesFalsas = [
  { ticker: 'CRUS', sequencia: 3 },
  { ticker: 'CRUS', sequencia: 2 },
  { ticker: 'GDHD', sequencia: 1 },
] as unknown as Negociacao[];

describe('ConsultarHistoricoUseCase', () => {
  test('consulta o repositório com o ticker normalizado e o limite padrão', async () => {
    const { repositorio, chamadas } = criarRepositorioFalso(negociacoesFalsas);
    const useCase = new ConsultarHistoricoUseCase(repositorio);

    const historico = await useCase.executar('  crus ');

    expect(chamadas).toEqual([{ ticker: 'CRUS', limite: LIMITE_HISTORICO_PADRAO }]);
    expect(historico).toHaveLength(2);
    expect(historico.every((negociacao) => negociacao.ticker === 'CRUS')).toBe(true);
  });

  test('respeita o limite informado e trunca valores fracionários', async () => {
    const { repositorio, chamadas } = criarRepositorioFalso(negociacoesFalsas);
    const useCase = new ConsultarHistoricoUseCase(repositorio);

    await useCase.executar('CRUS', 1.9);

    expect(chamadas).toEqual([{ ticker: 'CRUS', limite: 1 }]);
  });

  test('limita o histórico ao máximo permitido', async () => {
    const { repositorio, chamadas } = criarRepositorioFalso(negociacoesFalsas);
    const useCase = new ConsultarHistoricoUseCase(repositorio);

    await useCase.executar('CRUS', 10_000);

    expect(chamadas).toEqual([{ ticker: 'CRUS', limite: LIMITE_HISTORICO_MAXIMO }]);
  });

  test('recusa ticker vazio', async () => {
    const { repositorio, chamadas } = criarRepositorioFalso(negociacoesFalsas);
    const useCase = new ConsultarHistoricoUseCase(repositorio);

    await expect(useCase.executar('   ')).rejects.toBeInstanceOf(BadRequestException);
    expect(chamadas).toHaveLength(0);
  });

  test('recusa limite inválido', async () => {
    const { repositorio } = criarRepositorioFalso(negociacoesFalsas);
    const useCase = new ConsultarHistoricoUseCase(repositorio);

    await expect(useCase.executar('CRUS', 0)).rejects.toBeInstanceOf(BadRequestException);
    await expect(useCase.executar('CRUS', Number.NaN)).rejects.toBeInstanceOf(BadRequestException);
  });
});
