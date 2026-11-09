import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ClientesModule } from './clientes/clientes.module';
import { HealthController } from './health/health.controller';
import { OrdensServicoModule } from './ordens-servico/ordens-servico.module';
import { PrismaModule } from './prisma/prisma.module';
import { validarAmbiente } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validarAmbiente,
    }),
    PrismaModule,
    AuthModule,
    ClientesModule,
    OrdensServicoModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
