import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CadastrarClienteInput,
  CadastrarVeiculoInput,
  ClienteCriado,
  ClienteLookup,
  ClientesRepository,
  VeiculoCriado,
} from '../application/clientes.repository';

@Injectable()
export class PrismaClientesRepository implements ClientesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async cadastrar(input: CadastrarClienteInput): Promise<ClienteCriado> {
    try {
      return await this.prisma.cliente.create({
        data: input,
        select: { id: true, nome: true, email: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Já existe cliente com esse documento');
      }
      throw error;
    }
  }

  async cadastrarVeiculo(input: CadastrarVeiculoInput): Promise<VeiculoCriado> {
    try {
      return await this.prisma.veiculo.create({
        data: input,
        select: {
          id: true,
          clienteId: true,
          placa: true,
          marca: true,
          modelo: true,
          ano: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Já existe veículo com essa placa');
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new NotFoundException('Cliente não encontrado');
      }
      throw error;
    }
  }

  async buscarPorCpf(cpf: string): Promise<ClienteLookup | null> {
    const cliente = await this.prisma.cliente.findUnique({
      where: { documento: cpf },
      select: { id: true, ativo: true },
    });
    return cliente ? { clienteId: cliente.id, ativo: cliente.ativo } : null;
  }
}
