import {
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, SagaStatus, StatusOS as PrismaStatusOS } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaOrdensServicoRepository } from './prisma-ordens-servico.repository';

const ordemId = 'a0f3f6b8-8ee1-4e50-8a5b-1c4221a9c002';
const clienteId = '9ec7fc13-63a9-4c65-99fd-5dd33ae93d8e';
const veiculoId = 'd344537d-1cd6-4f37-89d5-6097b8ad768c';
const agora = new Date('2026-01-01T10:00:00.000Z');

function detalhe(status = PrismaStatusOS.RECEBIDA) {
  return {
    id: ordemId,
    numero: 1,
    clienteId,
    veiculoId,
    status,
    diagnostico: null,
    dataCriacao: agora,
    cliente: { id: clienteId, nome: 'Ana' },
    veiculo: {
      id: veiculoId,
      placa: 'ABC1D23',
      marca: 'Marca',
      modelo: 'Modelo',
      ano: 2020,
    },
    historico: [
      {
        id: 'historico-1',
        statusAnterior: null,
        statusNovo: PrismaStatusOS.RECEBIDA,
        observacao: 'Ordem aberta',
        createdAt: agora,
      },
    ],
  };
}

function prismaErro(code: string) {
  return new Prisma.PrismaClientKnownRequestError('database error', {
    code,
    clientVersion: '5.22.0',
  });
}

describe('PrismaOrdensServicoRepository', () => {
  let moduleRef: TestingModule;
  let repository: PrismaOrdensServicoRepository;

  const transaction = {
    cliente: { findUnique: jest.fn() },
    veiculo: { findFirst: jest.fn() },
    ordemServico: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    historicoStatusOS: {
      create: jest.fn(),
      createMany: jest.fn(),
    },
    sagaInstance: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    outboxEvent: {
      create: jest.fn((input: { data: { eventType: string } }) =>
        Promise.resolve(input),
      ),
    },
  };
  const prisma = {
    $transaction: jest.fn(
      (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
    ordemServico: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    transaction.cliente.findUnique.mockResolvedValue({
      id: clienteId,
      ativo: true,
    });
    transaction.veiculo.findFirst.mockResolvedValue({ id: veiculoId });
    transaction.ordemServico.create.mockResolvedValue({
      id: ordemId,
      numero: 1,
      status: PrismaStatusOS.RECEBIDA,
    });
    transaction.ordemServico.findUnique.mockResolvedValue(detalhe());
    transaction.ordemServico.updateMany.mockResolvedValue({ count: 1 });
    transaction.historicoStatusOS.create.mockResolvedValue({});
    transaction.historicoStatusOS.createMany.mockResolvedValue({ count: 2 });
    transaction.sagaInstance.create.mockResolvedValue({});
    transaction.sagaInstance.updateMany.mockResolvedValue({ count: 1 });
    transaction.outboxEvent.create.mockResolvedValue({});

    moduleRef = await Test.createTestingModule({
      providers: [
        PrismaOrdensServicoRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    repository = moduleRef.get(PrismaOrdensServicoRepository);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('abre OS, registra histórico e Saga e grava evento na mesma transação', async () => {
    const resultado = await repository.abrir({
      id: ordemId,
      clienteId,
      veiculoId,
    });

    expect(resultado.status).toBe('RECEBIDA');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(transaction.ordemServico.create).toHaveBeenCalled();
    expect(transaction.historicoStatusOS.create).toHaveBeenCalled();
    expect(transaction.sagaInstance.create).toHaveBeenCalled();
    expect(
      transaction.outboxEvent.create.mock.calls[0]?.[0].data.eventType,
    ).toBe('os.order-created');
  });

  it('não abre OS para cliente inexistente ou inativo', async () => {
    transaction.cliente.findUnique.mockResolvedValueOnce(null);
    await expect(
      repository.abrir({ id: ordemId, clienteId, veiculoId }),
    ).rejects.toThrow(NotFoundException);

    transaction.cliente.findUnique.mockResolvedValueOnce({
      id: clienteId,
      ativo: false,
    });
    await expect(
      repository.abrir({ id: ordemId, clienteId, veiculoId }),
    ).rejects.toThrow(ForbiddenException);
    expect(transaction.ordemServico.create).not.toHaveBeenCalled();
  });

  it('não abre OS com veículo de outro cliente ou inexistente', async () => {
    transaction.veiculo.findFirst.mockResolvedValueOnce(null);

    await expect(
      repository.abrir({ id: ordemId, clienteId, veiculoId }),
    ).rejects.toThrow(NotFoundException);
    expect(transaction.ordemServico.create).not.toHaveBeenCalled();
  });

  it('mapeia consulta por ID e retorna null quando não existe', async () => {
    prisma.ordemServico.findUnique
      .mockResolvedValueOnce(detalhe(PrismaStatusOS.EM_EXECUCAO))
      .mockResolvedValueOnce(null);

    const encontrada = await repository.buscarPorId(ordemId);

    expect(encontrada?.status).toBe('EM_EXECUCAO');
    expect(encontrada?.historico[0].statusAnterior).toBeNull();
    await expect(repository.buscarPorId(ordemId)).resolves.toBeNull();
  });

  it('persiste diagnóstico, transições, Saga e pedido de orçamento atomicamente', async () => {
    const atual = {
      ...detalhe(),
      version: 0,
      dataInicioDiagnostico: null,
      saga: { id: 'saga-1', status: SagaStatus.STARTED, version: 0 },
    };
    const resultado = {
      ...detalhe(PrismaStatusOS.AGUARDANDO_APROVACAO),
      diagnostico: 'Falha identificada',
      historico: [
        ...detalhe().historico,
        {
          id: 'historico-2',
          statusAnterior: PrismaStatusOS.RECEBIDA,
          statusNovo: PrismaStatusOS.EM_DIAGNOSTICO,
          observacao: 'Diagnóstico registrado',
          createdAt: agora,
        },
        {
          id: 'historico-3',
          statusAnterior: PrismaStatusOS.EM_DIAGNOSTICO,
          statusNovo: PrismaStatusOS.AGUARDANDO_APROVACAO,
          observacao: 'Diagnóstico registrado',
          createdAt: agora,
        },
      ],
    };
    transaction.ordemServico.findUnique
      .mockResolvedValueOnce(atual)
      .mockResolvedValueOnce(resultado);

    const retorno = await repository.registrarDiagnostico({
      ordemServicoId: ordemId,
      diagnostico: 'Falha identificada',
    });

    expect(retorno.status).toBe('AGUARDANDO_APROVACAO');
    expect(transaction.ordemServico.updateMany).toHaveBeenCalled();
    expect(transaction.sagaInstance.updateMany).toHaveBeenCalled();
    expect(transaction.historicoStatusOS.createMany).toHaveBeenCalled();
    expect(
      transaction.outboxEvent.create.mock.calls[0]?.[0].data.eventType,
    ).toBe('billing.quote-requested');
  });

  it('trata repetição idempotente do mesmo diagnóstico sem duplicar evento', async () => {
    const atual = {
      ...detalhe(PrismaStatusOS.AGUARDANDO_APROVACAO),
      diagnostico: 'Falha identificada',
      version: 1,
      dataInicioDiagnostico: agora,
      saga: {
        id: 'saga-1',
        status: SagaStatus.WAITING_FOR_QUOTE,
        version: 1,
      },
    };
    transaction.ordemServico.findUnique
      .mockResolvedValueOnce(atual)
      .mockResolvedValueOnce(detalhe(PrismaStatusOS.AGUARDANDO_APROVACAO));

    await repository.registrarDiagnostico({
      ordemServicoId: ordemId,
      diagnostico: 'Falha identificada',
    });

    expect(transaction.ordemServico.updateMany).not.toHaveBeenCalled();
    expect(transaction.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('rejeita ordem inexistente, Saga ausente e transição fora de sequência', async () => {
    transaction.ordemServico.findUnique.mockResolvedValueOnce(null);
    await expect(
      repository.registrarDiagnostico({
        ordemServicoId: ordemId,
        diagnostico: 'Falha identificada',
      }),
    ).rejects.toThrow(NotFoundException);

    transaction.ordemServico.findUnique.mockResolvedValueOnce({
      ...detalhe(),
      saga: null,
    });
    await expect(
      repository.registrarDiagnostico({
        ordemServicoId: ordemId,
        diagnostico: 'Falha identificada',
      }),
    ).rejects.toThrow(InternalServerErrorException);

    transaction.ordemServico.findUnique.mockResolvedValueOnce({
      ...detalhe(PrismaStatusOS.FINALIZADA),
      saga: {
        id: 'saga-1',
        status: SagaStatus.COMPLETED,
        version: 2,
      },
    });
    await expect(
      repository.registrarDiagnostico({
        ordemServicoId: ordemId,
        diagnostico: 'Falha identificada',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('aborta atualização quando a versão foi alterada concorrentemente', async () => {
    transaction.ordemServico.findUnique.mockResolvedValueOnce({
      ...detalhe(),
      version: 0,
      dataInicioDiagnostico: null,
      saga: { id: 'saga-1', status: SagaStatus.STARTED, version: 0 },
    });
    transaction.ordemServico.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      repository.registrarDiagnostico({
        ordemServicoId: ordemId,
        diagnostico: 'Falha identificada',
      }),
    ).rejects.toThrow(ConflictException);
    expect(transaction.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('converte conflito de serialização do PostgreSQL em conflito de domínio', async () => {
    prisma.$transaction.mockRejectedValueOnce(prismaErro('P2034'));

    await expect(
      repository.registrarDiagnostico({
        ordemServicoId: ordemId,
        diagnostico: 'Falha identificada',
      }),
    ).rejects.toThrow(ConflictException);
  });
});
