import { StatusOS } from './status-os';

export interface AbrirOrdemServico {
  id: string;
  clienteId: string;
  veiculoId: string;
  criadaEm?: Date;
}

export interface ReconstituirOrdemServico extends AbrirOrdemServico {
  status: StatusOS;
}

export interface TransicaoStatusOS {
  statusAnterior: StatusOS;
  statusNovo: StatusOS;
  ocorridaEm: Date;
}

const transicoesPermitidas: Readonly<Record<StatusOS, readonly StatusOS[]>> = {
  [StatusOS.RECEBIDA]: [StatusOS.EM_DIAGNOSTICO],
  [StatusOS.EM_DIAGNOSTICO]: [StatusOS.AGUARDANDO_APROVACAO],
  [StatusOS.AGUARDANDO_APROVACAO]: [
    StatusOS.EM_DIAGNOSTICO,
    StatusOS.EM_EXECUCAO,
  ],
  [StatusOS.EM_EXECUCAO]: [StatusOS.FINALIZADA],
  [StatusOS.FINALIZADA]: [StatusOS.ENTREGUE],
  [StatusOS.ENTREGUE]: [],
};

export class TransicaoStatusInvalidaError extends Error {
  constructor(statusAtual: StatusOS, proximoStatus: StatusOS) {
    super(`Transição de status inválida: ${statusAtual} -> ${proximoStatus}`);
    this.name = 'TransicaoStatusInvalidaError';
  }
}

export class OrdemServico {
  private statusAtual = StatusOS.RECEBIDA;

  private constructor(
    readonly id: string,
    readonly clienteId: string,
    readonly veiculoId: string,
    readonly criadaEm: Date,
    status = StatusOS.RECEBIDA,
  ) {
    this.statusAtual = status;
  }

  static abrir(input: AbrirOrdemServico): OrdemServico {
    if (!input.id.trim()) {
      throw new Error('id da OS é obrigatório');
    }
    if (!input.clienteId.trim()) {
      throw new Error('clienteId é obrigatório');
    }
    if (!input.veiculoId.trim()) {
      throw new Error('veiculoId é obrigatório');
    }

    return new OrdemServico(
      input.id,
      input.clienteId,
      input.veiculoId,
      input.criadaEm ?? new Date(),
    );
  }

  static reconstituir(input: ReconstituirOrdemServico): OrdemServico {
    if (
      !input.id.trim() ||
      !input.clienteId.trim() ||
      !input.veiculoId.trim()
    ) {
      throw new Error('id, clienteId e veiculoId são obrigatórios');
    }

    return new OrdemServico(
      input.id,
      input.clienteId,
      input.veiculoId,
      input.criadaEm ?? new Date(),
      input.status,
    );
  }

  get status(): StatusOS {
    return this.statusAtual;
  }

  transicionar(
    proximoStatus: StatusOS,
    ocorridaEm = new Date(),
  ): TransicaoStatusOS {
    if (!transicoesPermitidas[this.statusAtual].includes(proximoStatus)) {
      throw new TransicaoStatusInvalidaError(this.statusAtual, proximoStatus);
    }

    const transicao = {
      statusAnterior: this.statusAtual,
      statusNovo: proximoStatus,
      ocorridaEm,
    };

    this.statusAtual = proximoStatus;
    return transicao;
  }
}
