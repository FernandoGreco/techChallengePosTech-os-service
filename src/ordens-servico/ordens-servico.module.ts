import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AbrirOrdemServicoUseCase } from './application/abrir-ordem-servico.use-case';
import { ConsultarOrdemServicoUseCase } from './application/consultar-ordem-servico.use-case';
import { ORDENS_SERVICO_REPOSITORY } from './application/ordens-servico.repository';
import { RegistrarDiagnosticoUseCase } from './application/registrar-diagnostico.use-case';
import { PrismaOrdensServicoRepository } from './infrastructure/prisma-ordens-servico.repository';
import { OrdensServicoController } from './presentation/ordens-servico.controller';

@Module({
  imports: [AuthModule],
  controllers: [OrdensServicoController],
  providers: [
    AbrirOrdemServicoUseCase,
    ConsultarOrdemServicoUseCase,
    RegistrarDiagnosticoUseCase,
    {
      provide: ORDENS_SERVICO_REPOSITORY,
      useClass: PrismaOrdensServicoRepository,
    },
  ],
})
export class OrdensServicoModule {}
