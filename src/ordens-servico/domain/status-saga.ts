export enum StatusSaga {
  STARTED = 'STARTED',
  WAITING_FOR_QUOTE = 'WAITING_FOR_QUOTE',
  WAITING_FOR_APPROVAL = 'WAITING_FOR_APPROVAL',
  RESERVING_STOCK = 'RESERVING_STOCK',
  WAITING_FOR_PAYMENT = 'WAITING_FOR_PAYMENT',
  WAITING_FOR_EXECUTION = 'WAITING_FOR_EXECUTION',
  COMPLETED = 'COMPLETED',
  COMPENSATING = 'COMPENSATING',
  FAILED = 'FAILED',
}

export type EventoSaga =
  | 'DIAGNOSTICO_CONCLUIDO'
  | 'ORCAMENTO_GERADO'
  | 'ORCAMENTO_RECUSADO'
  | 'ORCAMENTO_APROVADO'
  | 'ESTOQUE_RESERVADO'
  | 'ESTOQUE_INDISPONIVEL'
  | 'PAGAMENTO_CONFIRMADO'
  | 'PAGAMENTO_RECUSADO'
  | 'EXECUCAO_CONCLUIDA'
  | 'COMPENSACAO_CONCLUIDA';

const transicoes: Readonly<
  Record<StatusSaga, Partial<Record<EventoSaga, StatusSaga>>>
> = {
  [StatusSaga.STARTED]: {
    DIAGNOSTICO_CONCLUIDO: StatusSaga.WAITING_FOR_QUOTE,
  },
  [StatusSaga.WAITING_FOR_QUOTE]: {
    ORCAMENTO_GERADO: StatusSaga.WAITING_FOR_APPROVAL,
  },
  [StatusSaga.WAITING_FOR_APPROVAL]: {
    ORCAMENTO_RECUSADO: StatusSaga.WAITING_FOR_QUOTE,
    ORCAMENTO_APROVADO: StatusSaga.RESERVING_STOCK,
  },
  [StatusSaga.RESERVING_STOCK]: {
    ESTOQUE_RESERVADO: StatusSaga.WAITING_FOR_PAYMENT,
    ESTOQUE_INDISPONIVEL: StatusSaga.COMPENSATING,
  },
  [StatusSaga.WAITING_FOR_PAYMENT]: {
    PAGAMENTO_CONFIRMADO: StatusSaga.WAITING_FOR_EXECUTION,
    PAGAMENTO_RECUSADO: StatusSaga.COMPENSATING,
  },
  [StatusSaga.WAITING_FOR_EXECUTION]: {
    EXECUCAO_CONCLUIDA: StatusSaga.COMPLETED,
  },
  [StatusSaga.COMPENSATING]: {
    COMPENSACAO_CONCLUIDA: StatusSaga.FAILED,
  },
  [StatusSaga.COMPLETED]: {},
  [StatusSaga.FAILED]: {},
};

export class TransicaoSagaInvalidaError extends Error {
  constructor(statusAtual: StatusSaga, evento: EventoSaga) {
    super(`Evento ${evento} inválido para Saga no estado ${statusAtual}`);
    this.name = 'TransicaoSagaInvalidaError';
  }
}

export class SagaOrquestrada {
  private constructor(
    readonly ordemServicoId: string,
    private statusAtual: StatusSaga,
  ) {}

  static iniciar(ordemServicoId: string): SagaOrquestrada {
    if (!ordemServicoId.trim()) {
      throw new Error('ordemServicoId é obrigatório');
    }
    return new SagaOrquestrada(ordemServicoId, StatusSaga.STARTED);
  }

  static reconstituir(
    ordemServicoId: string,
    status: StatusSaga,
  ): SagaOrquestrada {
    if (!ordemServicoId.trim()) {
      throw new Error('ordemServicoId é obrigatório');
    }
    return new SagaOrquestrada(ordemServicoId, status);
  }

  get status(): StatusSaga {
    return this.statusAtual;
  }

  aplicar(evento: EventoSaga): StatusSaga {
    const proximoStatus = transicoes[this.statusAtual][evento];
    if (!proximoStatus) {
      throw new TransicaoSagaInvalidaError(this.statusAtual, evento);
    }

    this.statusAtual = proximoStatus;
    return proximoStatus;
  }
}
