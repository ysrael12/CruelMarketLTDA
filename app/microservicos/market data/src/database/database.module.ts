import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Ativo } from '../domain/Ativo';
import { EventoMercado } from '../domain/EventoMercado';
import { Negociacao } from '../domain/Negociacao';
import { lerAtivosConfig } from './ativos.config';
import { ATIVOS_CONFIG, SeedService } from './seed.service';

const caminhoBanco = resolve(process.env.DB_PATH ?? 'data/market.db');

if (caminhoBanco !== ':memory:') {
  mkdirSync(dirname(caminhoBanco), { recursive: true });
}

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: caminhoBanco,
      autoLoadEntities: true,
      synchronize: process.env.DB_SYNCHRONIZE !== 'false',
      logging: process.env.DB_LOGGING === 'true',
    }),
    TypeOrmModule.forFeature([Ativo, Negociacao, EventoMercado]),
  ],
  providers: [
    SeedService,
    { provide: ATIVOS_CONFIG, useFactory: () => lerAtivosConfig() },
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
