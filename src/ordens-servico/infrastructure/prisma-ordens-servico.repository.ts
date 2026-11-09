import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  SagaStatus as PrismaSagaStatus,
  StatusOS as PrismaStatusOS,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEnvelope } from '../../shared/events/event-envelope';
import { TransicaoStatusInvalidaError } from '../domain/ordem-servico';
import {
  AbrirOrdemServicoInput,
  HistoricoStatusView,
  OrdemServicoDetalhe,
  OrdensServicoRepository,
  RegistrarDiagnosticoInput,
} from '../application/ordens-servico.repository';
import { OrdemServico } from '../domain/ordem-servico';
import {
  SagaOrquestrada,
  StatusSaga,
  TransicaoSagaInvalidaError,
} from '../domain/status-saga';
import { StatusOS } from '../domain/status-os';

const incluirDetalhes = {
  cliente: { select: { id: true, nome: true } },
  veiculo: {
    select: { id: true, placa: true, marca: true, modelo: true, ano: true },
  },
  historico: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.OrdemServicoInclude;

type OrdemDetalhada = Prisma.OrdemServicoGetPayload<{
  include: typeof incluirDetalhes;
}>;

const statusOSParaPrisma: Record<StatusOS, PrismaStatusOS> = {
  [StatusOS.RECEBIDA]: PrismaStatusOS.RECEBIDA,
  [StatusOS.EM_DIAGNOSTICO]: PrismaStatusOS.EM_DIAGNOSTICO,
  [StatusOS.AGUARDANDO_APROVACAO]: PrismaStatusOS.AGUARDANDO_APROVACAO,
  [StatusOS.EM_EXECUCAO]: PrismaStatusOS.EM_EXECUCAO,
  [StatusOS.FINALIZADA]: PrismaStatusOS.FINALIZADA,
  [StatusOS.ENTREGUE]: PrismaStatusOS.ENTREGUE,
};

const statusOSParaDominio: Record<PrismaStatusOS, StatusOS> = {
  [PrismaStatusOS.RECEBIDA]: StatusOS.RECEBIDA,
  [PrismaStatusOS.EM_DIAGNOSTICO]: StatusOS.EM_DIAGNOSTICO,
  [PrismaStatusOS.AGUARDANDO_APROVACAO]: StatusOS.AGUARDANDO_APROVACAO,
  [PrismaStatusOS.EM_EXECUCAO]: StatusOS.EM_EXECUCAO,
  [PrismaStatusOS.FINALIZADA]: StatusOS.FINALIZADA,
  [PrismaStatusOS.ENTREGUE]: StatusOS.ENTREGUE,
};

const statusSagaParaPrisma: Record<StatusSaga, PrismaSagaStatus> = {
  [StatusSaga.STARTED]: PrismaSagaStatus.STARTED,
  [StatusSaga.WAITING_FOR_QUOTE]: PrismaSagaStatus.WAITING_FOR_QUOTE,
  [StatusSaga.WAITING_FOR_APPROVAL]: PrismaSagaStatus.WAITING_FOR_APPROVAL,
  [StatusSaga.RESERVING_STOCK]: PrismaSagaStatus.RESERVING_STOCK,
  [StatusSaga.WAITING_FOR_PAYMENT]: PrismaSagaStatus.WAITING_FOR_PAYMENT,
  [StatusSaga.WAITING_FOR_EXECUTION]: PrismaSagaStatus.WAITING_FOR_EXECUTION,
  [StatusSaga.COMPLETED]: PrismaSagaStatus.COMPLETED,
  [StatusSaga.COMPENSATING]: PrismaSagaStatus.COMPENSATING,
  [StatusSaga.FAILED]: PrismaSagaStatus.FAILED,
};

const statusSagaParaDominio: Record<PrismaSagaStatus, StatusSaga> = {
  [PrismaSagaStatus.STARTED]: StatusSaga.STARTED,
  [PrismaSagaStatus.WAITING_FOR_QUOTE]: StatusSaga.WAITING_FOR_QUOTE,
  [PrismaSagaStatus.WAITING_FOR_APPROVAL]: StatusSaga.WAITING_FOR_APPROVAL,
  [PrismaSagaStatus.RESERVING_STOCK]: StatusSaga.RESERVING_STOCK,
  [PrismaSagaStatus.WAITING_FOR_PAYMENT]: StatusSaga.WAITING_FOR_PAYMENT,
  [PrismaSagaStatus.WAITING_FOR_EXECUTION]: StatusSaga.WAITING_FOR_EXECUTION,
  [PrismaSagaStatus.COMPLETED]: StatusSaga.COMPLETED,
  [PrismaSagaStatus.COMPENSATING]: StatusSaga.COMPENSATING,
  [PrismaSagaStatus.FAILED]: StatusSaga.FAILED,
};

function mapearHistorico(
  statusAnterior: PrismaStatusOS | null,
  statusNovo: PrismaStatusOS,
  observacao: string | null,
  id: string,
  createdAt: Date,
): HistoricoStatusView {
  return {
    id,
    statusAnterior: statusAnterior ? statusOSParaDominio[statusAnterior] : null,
    statusNovo: statusOSParaDominio[statusNovo],
    observacao,
    ocorridaEm: createdAt,
  };
}

function mapearOrdemServico(ordem: OrdemDetalhada): OrdemServicoDetalhe {
  return {
    id: ordem.id,
    numero: ordem.numero,
    clienteId: ordem.clienteId,
    veiculoId: ordem.veiculoId,
    status: statusOSParaDominio[ordem.status],
    diagnostico: ordem.diagnostico,
    dataCriacao: ordem.dataCriacao,
    cliente: ordem.cliente,
    veiculo: ordem.veiculo,
    historico: ordem.historico.map((item) =>
      mapearHistorico(
        item.statusAnterior,
        item.statusNovo,
        item.observacao,
        item.id,
        item.createdAt,
      ),
    ),
  };
}

@Injectable()
export class PrismaOrdensServicoRepository implements OrdensServicoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async abrir(input: AbrirOrdemServicoInput): Promise<OrdemServicoDetalhe> {
    return this.prisma.$transaction(
      async (transaction) => {
        const cliente = await transaction.cliente.findUnique({
          where: { id: input.clienteId },
          select: { id: true, ativo: true },
        });
        if (!cliente) {
          throw new NotFoundException('Cliente não encontrado');
        }
        if (!cliente.ativo) {
          throw new ForbiddenException('Cliente inativo');
        }

        const veiculo = await transaction.veiculo.findFirst({
          where: { id: input.veiculoId, clienteId: input.clienteId },
          select: { id: true },
        });
        if (!veiculo) {
          throw new NotFoundException(
            'Veículo não encontrado para o cliente informado',
          );
        }

        const ordem = await transaction.ordemServico.create({
          data: {
            id: input.id,
            clienteId: input.clienteId,
            veiculoId: input.veiculoId,
          },
          select: { id: true, numero: true, status: true },
        });
        const agora = new Date();
        await transaction.historicoStatusOS.create({
          data: {
            ordemServicoId: ordem.id,
            statusAnterior: null,
            statusNovo: PrismaStatusOS.RECEBIDA,
            observacao: 'Ordem de serviço aberta',
            createdAt: agora,
          },
        });
        await transaction.sagaInstance.create({
          data: {
            ordemServicoId: ordem.id,
            status: PrismaSagaStatus.STARTED,
          },
        });

        const evento: EventEnvelope<{
          ordemServicoId: string;
          numero: number;
          clienteId: string;
          veiculoId: string;
        }> = {
          eventId: randomUUID(),
          eventType: 'os.order-created',
          eventVersion: 1,
          occurredAt: agora.toISOString(),
          aggregateId: ordem.id,
          correlationId: ordem.id,
          payload: {
            ordemServicoId: ordem.id,
            numero: ordem.numero,
            clienteId: input.clienteId,
            veiculoId: input.veiculoId,
          },
        };
        await transaction.outboxEvent.create({
          data: {
            id: evento.eventId,
            eventType: evento.eventType,
            eventVersion: evento.eventVersion,
            aggregateId: evento.aggregateId,
            correlationId: evento.correlationId,
            occurredAt: agora,
            payload: evento.payload,
          },
        });

        const criada = await transaction.ordemServico.findUnique({
          where: { id: ordem.id },
          include: incluirDetalhes,
        });
        if (!criada) {
          throw new InternalServerErrorException(
            'Ordem criada, mas não foi possível carregá-la',
          );
        }
        return mapearOrdemServico(criada);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async buscarPorId(id: string): Promise<OrdemServicoDetalhe | null> {
    const ordem = await this.prisma.ordemServico.findUnique({
      where: { id },
      include: incluirDetalhes,
    });
    return ordem ? mapearOrdemServico(ordem) : null;
  }

  async registrarDiagnostico(
    input: RegistrarDiagnosticoInput,
  ): Promise<OrdemServicoDetalhe> {
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const atual = await transaction.ordemServico.findUnique({
            where: { id: input.ordemServicoId },
            include: { saga: true },
          });
          if (!atual) {
            throw new NotFoundException('Ordem de serviço não encontrada');
          }
          if (!atual.saga) {
            throw new InternalServerErrorException(
              'Ordem de serviço sem instância de Saga',
            );
          }

          if (
            atual.status === PrismaStatusOS.AGUARDANDO_APROVACAO &&
            atual.saga.status === PrismaSagaStatus.WAITING_FOR_QUOTE &&
            atual.diagnostico === input.diagnostico
          ) {
            const existente = await transaction.ordemServico.findUnique({
              where: { id: atual.id },
              include: incluirDetalhes,
            });
            if (!existente) {
              throw new InternalServerErrorException(
                'Ordem de serviço não foi carregada',
              );
            }
            return mapearOrdemServico(existente);
          }

          const statusAtual = statusOSParaDominio[atual.status];
          const ordem = OrdemServico.reconstituir({
            id: atual.id,
            clienteId: atual.clienteId,
            veiculoId: atual.veiculoId,
            criadaEm: atual.dataCriacao,
            status: statusAtual,
          });
          const saga = SagaOrquestrada.reconstituir(
            atual.id,
            statusSagaParaDominio[atual.saga.status],
          );
          const agora = new Date();
          const historico = [];

          if (ordem.status === StatusOS.RECEBIDA) {
            historico.push(ordem.transicionar(StatusOS.EM_DIAGNOSTICO, agora));
          }
          historico.push(
            ordem.transicionar(StatusOS.AGUARDANDO_APROVACAO, agora),
          );
          const statusSaga = saga.aplicar('DIAGNOSTICO_CONCLUIDO');

          const atualizada = await transaction.ordemServico.updateMany({
            where: { id: atual.id, version: atual.version },
            data: {
              status: statusOSParaPrisma[ordem.status],
              diagnostico: input.diagnostico,
              dataInicioDiagnostico: atual.dataInicioDiagnostico ?? agora,
              version: { increment: 1 },
            },
          });
          if (atualizada.count !== 1) {
            throw new ConflictException(
              'A ordem foi alterada por outra operação; tente novamente',
            );
          }

          const sagaAtualizada = await transaction.sagaInstance.updateMany({
            where: {
              id: atual.saga.id,
              version: atual.saga.version,
            },
            data: {
              status: statusSagaParaPrisma[statusSaga],
              version: { increment: 1 },
            },
          });
          if (sagaAtualizada.count !== 1) {
            throw new ConflictException(
              'A Saga foi alterada por outra operação; tente novamente',
            );
          }

          await transaction.historicoStatusOS.createMany({
            data: historico.map((transicao) => ({
              ordemServicoId: atual.id,
              statusAnterior: statusOSParaPrisma[transicao.statusAnterior],
              statusNovo: statusOSParaPrisma[transicao.statusNovo],
              observacao: 'Diagnóstico registrado',
              createdAt: transicao.ocorridaEm,
            })),
          });

          const evento: EventEnvelope<{
            ordemServicoId: string;
            numero: number;
            diagnostico: string;
          }> = {
            eventId: randomUUID(),
            eventType: 'billing.quote-requested',
            eventVersion: 1,
            occurredAt: agora.toISOString(),
            aggregateId: atual.id,
            correlationId: atual.id,
            payload: {
              ordemServicoId: atual.id,
              numero: atual.numero,
              diagnostico: input.diagnostico,
            },
          };
          await transaction.outboxEvent.create({
            data: {
              id: evento.eventId,
              eventType: evento.eventType,
              eventVersion: evento.eventVersion,
              aggregateId: evento.aggregateId,
              correlationId: evento.correlationId,
              occurredAt: agora,
              payload: evento.payload,
            },
          });

          const atualizadaDetalhe = await transaction.ordemServico.findUnique({
            where: { id: atual.id },
            include: incluirDetalhes,
          });
          if (!atualizadaDetalhe) {
            throw new InternalServerErrorException(
              'Ordem de serviço não foi carregada após o diagnóstico',
            );
          }
          return mapearOrdemServico(atualizadaDetalhe);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof TransicaoStatusInvalidaError ||
        error instanceof TransicaoSagaInvalidaError
      ) {
        throw new ConflictException(error.message);
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Conflito de concorrência ao registrar diagnóstico',
        );
      }
      throw error;
    }
  }
}
