import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Papeis } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { CadastrarClienteUseCase } from '../application/cadastrar-cliente.use-case';
import { CadastrarVeiculoUseCase } from '../application/cadastrar-veiculo.use-case';
import { CadastrarClienteDto } from './dto/cadastrar-cliente.dto';
import { CadastrarVeiculoDto } from './dto/cadastrar-veiculo.dto';

@Controller('api/v1/clientes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Papeis('ADMIN', 'ATENDENTE')
export class ClientesController {
  constructor(
    private readonly cadastrarCliente: CadastrarClienteUseCase,
    private readonly cadastrarVeiculo: CadastrarVeiculoUseCase,
  ) {}

  @Post()
  cadastrar(@Body() dto: CadastrarClienteDto) {
    return this.cadastrarCliente.execute(dto);
  }

  @Post(':clienteId/veiculos')
  @HttpCode(HttpStatus.CREATED)
  cadastrarVeiculoParaCliente(
    @Body() dto: CadastrarVeiculoDto,
    @Param('clienteId') clienteId: string,
  ) {
    return this.cadastrarVeiculo.execute({ ...dto, clienteId });
  }
}
