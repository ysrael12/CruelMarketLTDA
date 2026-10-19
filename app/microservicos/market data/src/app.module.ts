import { Module } from '@nestjs/common';
import { AppController } from './controller/app.controller';
import { HealthController } from './controller/health.controller';
import { DatabaseModule } from './database/database.module';
import { AppService } from './usecases/app.service';
import { provedoresMercado } from './usecases/mercado.providers';

@Module({
  imports: [DatabaseModule],
  controllers: [AppController, HealthController],
  providers: [AppService, ...provedoresMercado],
})
export class AppModule {}
