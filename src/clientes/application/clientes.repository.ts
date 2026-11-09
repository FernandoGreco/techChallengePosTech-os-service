import { TipoDocumento } from '../../shared/validators/documento';

export const CLIENTES_REPOSITORY = Symbol('CLIENTES_REPOSITORY');

export interface CadastrarClienteInput {
  nome: string;
  documento: string;
  tipoDocumento: TipoDocumento;
  telefone: string;
  email: string;
}

export interface ClienteCriado {
  id: string;
  nome: string;
  email: string;
}

export interface CadastrarVeiculoInput {
  clienteId: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
}

export interface VeiculoCriado {
  id: string;
  clienteId: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
}

export interface ClienteLookup {
  clienteId: string;
  ativo: boolean;
}

export interface ClientesRepository {
  cadastrar(input: CadastrarClienteInput): Promise<ClienteCriado>;
  cadastrarVeiculo(input: CadastrarVeiculoInput): Promise<VeiculoCriado>;
  buscarPorCpf(cpf: string): Promise<ClienteLookup | null>;
}
