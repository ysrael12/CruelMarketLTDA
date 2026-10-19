import { Module } from '@nestjs/common';
import { BrokerModule } from './broker/broker.module';
import { TradeExecutedConsumer } from './broker/trade-executed.consumer';
import { AppController } from './controller/app.controller';
import { AtivosController } from './controller/ativos.controller';
import { EventosController } from './controller/eventos.controller';
import { HealthController } from './controller/health.controller';
import { DatabaseModule } from './database/database.module';
import { AgendadorEventos } from './usecases/agendador-eventos.service';
import { AgendadorTick } from './usecases/agendador-tick.service';
import { AplicarEventoUseCase } from './usecases/AplicarEventoUseCase';
import { AppService } from './usecases/app.service';
import { ConsultarAtivoUseCase } from './usecases/ConsultarAtivoUseCase';
import { ConsultarAtivosUseCase } from './usecases/ConsultarAtivosUseCase';
import { ConsultarEventosUseCase } from './usecases/ConsultarEventosUseCase';
import { ConsultarHistoricoUseCase } from './usecases/ConsultarHistoricoUseCase';
import { ExecutarTickUseCase } from './usecases/ExecutarTickUseCase';
import { provedoresMercado } from './usecases/mercado.providers';
import { RegistrarNegociacaoUseCase } from './usecases/RegistrarNegociacaoUseCase';

@Module({
  imports: [DatabaseModule, BrokerModule],
  controllers: [AppController, AtivosController, EventosController, HealthController],
  providers: [
    AppService,
    ConsultarAtivosUseCase,
    ConsultarAtivoUseCase,
    ConsultarHistoricoUseCase,
    ConsultarEventosUseCase,
    RegistrarNegociacaoUseCase,
    ExecutarTickUseCase,
    AplicarEventoUseCase,
    TradeExecutedConsumer,
    AgendadorTick,
    AgendadorEventos,
    ...provedoresMercado,
  ],
})
export class AppModule {}
