import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

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
  ],
})
export class DatabaseModule {}
