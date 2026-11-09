import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CadastrarClienteInput } from '../application/clientes.repository';
import { PrismaClientesRepository } from './prisma-clientes.repository';

function prismaErro(code: string) {
  return new Prisma.PrismaClientKnownRequestError('database error', {
    code,
    clientVersion: '5.22.0',
  });
}

describe('PrismaClientesRepository', () => {
  let moduleRef: TestingModule;
  let repository: PrismaClientesRepository;
  const cliente = {
    id: 'cliente-1',
    nome: 'Ana',
    email: 'ana@example.com',
  };
  const prisma = {
    cliente: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    veiculo: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    moduleRef = await Test.createTestingModule({
      providers: [
        PrismaClientesRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    repository = moduleRef.get(PrismaClientesRepository);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('cadastra cliente sem expor o documento no resultado', async () => {
    prisma.cliente.create.mockResolvedValue(cliente);

    await expect(
      repository.cadastrar({
        nome: 'Ana',
        documento: '52998224725',
        tipoDocumento: 'CPF',
        telefone: '11999999999',
        email: 'ana@example.com',
      } satisfies CadastrarClienteInput),
    ).resolves.toEqual(cliente);
  });

  it('converte documento duplicado em conflito', async () => {
    prisma.cliente.create.mockRejectedValue(prismaErro('P2002'));

    await expect(
      repository.cadastrar({
        nome: 'Ana',
        documento: '52998224725',
        tipoDocumento: 'CPF',
        telefone: '11999999999',
        email: 'ana@example.com',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('converte placa duplicada em conflito', async () => {
    prisma.veiculo.create.mockRejectedValue(prismaErro('P2002'));

    await expect(
      repository.cadastrarVeiculo({
        clienteId: 'cliente-1',
        placa: 'ABC1D23',
        marca: 'Marca',
        modelo: 'Modelo',
        ano: 2020,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('converte cliente inexistente ao cadastrar veículo em não encontrado', async () => {
    prisma.veiculo.create.mockRejectedValue(prismaErro('P2003'));

    await expect(
      repository.cadastrarVeiculo({
        clienteId: 'cliente-1',
        placa: 'ABC1D23',
        marca: 'Marca',
        modelo: 'Modelo',
        ano: 2020,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('retorna somente ID e estado ativo para lookup de CPF', async () => {
    prisma.cliente.findUnique.mockResolvedValue({
      id: 'cliente-1',
      ativo: true,
    });

    await expect(repository.buscarPorCpf('52998224725')).resolves.toEqual({
      clienteId: 'cliente-1',
      ativo: true,
    });
  });

  it('retorna null para CPF sem cliente', async () => {
    prisma.cliente.findUnique.mockResolvedValue(null);

    await expect(repository.buscarPorCpf('52998224725')).resolves.toBeNull();
  });
});
