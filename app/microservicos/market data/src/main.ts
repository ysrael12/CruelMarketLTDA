import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  // front aberto via file:// envia Origin "null"; liberado para desenvolvimento
  app.enableCors();

  const porta = Number(process.env.PORT ?? 3000);
  await app.listen(porta);
  console.log(`[market-data] ouvindo na porta ${porta}`);
}

void bootstrap();
