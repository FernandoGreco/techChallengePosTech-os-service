import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InternalTokenGuard } from '../../auth/internal-token.guard';
import { ConsultarClientePorCpfUseCase } from '../application/consultar-cliente-por-cpf.use-case';
import { ConsultarClienteDto } from './dto/consultar-cliente.dto';

@Controller('internal/v1/clientes')
@UseGuards(InternalTokenGuard)
export class ClienteInternoController {
  constructor(
    private readonly consultarCliente: ConsultarClientePorCpfUseCase,
  ) {}

  @Post('lookup')
  @HttpCode(HttpStatus.OK)
  async consultarPorCpf(@Body() dto: ConsultarClienteDto) {
    const cliente = await this.consultarCliente.execute(dto.cpf);
    if (!cliente) {
      throw new NotFoundException('Cliente não encontrado');
    }
    if (!cliente.ativo) {
      throw new ForbiddenException('Cliente inativo');
    }
    return { clienteId: cliente.clienteId };
  }
}
