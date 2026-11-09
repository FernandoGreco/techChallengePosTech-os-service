import { StatusOS } from '../domain/status-os';

export const ORDENS_SERVICO_REPOSITORY = Symbol('ORDENS_SERVICO_REPOSITORY');

export interface AbrirOrdemServicoInput {
  id: string;
  clienteId: string;
  veiculoId: string;
}

export interface RegistrarDiagnosticoInput {
  ordemServicoId: string;
  diagnostico: string;
}

export interface HistoricoStatusView {
  id: string;
  statusAnterior: StatusOS | null;
  statusNovo: StatusOS;
  observacao: string | null;
  ocorridaEm: Date;
}

export interface OrdemServicoDetalhe {
  id: string;
  numero: number;
  clienteId: string;
  veiculoId: string;
  status: StatusOS;
  diagnostico: string | null;
  dataCriacao: Date;
  cliente: { id: string; nome: string };
  veiculo: {
    id: string;
    placa: string;
    marca: string;
    modelo: string;
    ano: number;
  };
  historico: HistoricoStatusView[];
}

export interface OrdensServicoRepository {
  abrir(input: AbrirOrdemServicoInput): Promise<OrdemServicoDetalhe>;
  buscarPorId(id: string): Promise<OrdemServicoDetalhe | null>;
  registrarDiagnostico(
    input: RegistrarDiagnosticoInput,
  ): Promise<OrdemServicoDetalhe>;
}
