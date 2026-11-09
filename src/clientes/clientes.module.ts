import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CadastrarClienteUseCase } from './application/cadastrar-cliente.use-case';
import { CadastrarVeiculoUseCase } from './application/cadastrar-veiculo.use-case';
import { ConsultarClientePorCpfUseCase } from './application/consultar-cliente-por-cpf.use-case';
import { CLIENTES_REPOSITORY } from './application/clientes.repository';
import { PrismaClientesRepository } from './infrastructure/prisma-clientes.repository';
import { ClienteInternoController } from './presentation/cliente-interno.controller';
import { ClientesController } from './presentation/clientes.controller';

@Module({
  imports: [AuthModule],
  controllers: [ClientesController, ClienteInternoController],
  providers: [
    CadastrarClienteUseCase,
    CadastrarVeiculoUseCase,
    ConsultarClientePorCpfUseCase,
    {
      provide: CLIENTES_REPOSITORY,
      useClass: PrismaClientesRepository,
    },
  ],
})
export class ClientesModule {}
