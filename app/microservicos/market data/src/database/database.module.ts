import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Ativo } from '../domain/Ativo';
import { EventoMercado } from '../domain/EventoMercado';
import { Negociacao } from '../domain/Negociacao';
import { ATIVO_REPOSITORY } from '../domain/ports/AtivoRepository';
import { EVENTO_MERCADO_REPOSITORY } from '../domain/ports/EventoMercadoRepository';
import { NEGOCIACAO_REPOSITORY } from '../domain/ports/NegociacaoRepository';
import { TypeOrmAtivoRepository } from './ativo.repository';
import { lerAtivosConfig } from './ativos.config';
import { TypeOrmEventoMercadoRepository } from './evento-mercado.repository';
import { TypeOrmNegociacaoRepository } from './negociacao.repository';
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
    TypeOrmAtivoRepository,
    TypeOrmNegociacaoRepository,
    TypeOrmEventoMercadoRepository,
    { provide: ATIVO_REPOSITORY, useExisting: TypeOrmAtivoRepository },
    { provide: NEGOCIACAO_REPOSITORY, useExisting: TypeOrmNegociacaoRepository },
    { provide: EVENTO_MERCADO_REPOSITORY, useExisting: TypeOrmEventoMercadoRepository },
  ],
  exports: [
    TypeOrmModule,
    ATIVO_REPOSITORY,
    NEGOCIACAO_REPOSITORY,
    EVENTO_MERCADO_REPOSITORY,
  ],
})
export class DatabaseModule {}
