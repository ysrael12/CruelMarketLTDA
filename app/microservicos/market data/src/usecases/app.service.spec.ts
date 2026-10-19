import 'reflect-metadata';
import { expect, test } from 'bun:test';
import { AppService } from './app.service';

test('informa o nome do servico', () => {
  expect(new AppService().obterInfo()).toEqual({
    servico: 'market-data',
    status: 'ok',
  });
});
