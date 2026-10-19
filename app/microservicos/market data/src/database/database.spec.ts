import 'reflect-metadata';
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';

let modulo: TestingModule;

beforeAll(async () => {
  modulo = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({
        type: 'better-sqlite3',
        database: ':memory:',
        synchronize: true,
      }),
    ],
  }).compile();
});

afterAll(async () => {
  await modulo.close();
});

test('conecta no SQLite em memoria', async () => {
  const dataSource = modulo.get<DataSource>(getDataSourceToken());
  const resultado = await dataSource.query('select 1 as ok');

  expect(resultado[0].ok).toBe(1);
});
