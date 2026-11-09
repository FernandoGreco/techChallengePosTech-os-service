import { BadRequestException } from '@nestjs/common';
import { CadastrarClienteUseCase } from './cadastrar-cliente.use-case';
import type { ClientesRepository } from './clientes.repository';
import { TipoDocumento } from '../../shared/validators/documento';

describe('CadastrarClienteUseCase', () => {
  const cadastrar = jest.fn();
  const repository: ClientesRepository = {
    cadastrar,
    cadastrarVeiculo: jest.fn(),
    buscarPorCpf: jest.fn(),
  };
  const useCase = new CadastrarClienteUseCase(repository);

  beforeEach(() => {
    jest.clearAllMocks();
    cadastrar.mockResolvedValue({
      id: 'cliente-1',
      nome: 'Ana',
      email: 'ana@example.com',
    });
  });

  it('normaliza documento, nome e e-mail antes de persistir', async () => {
    await useCase.execute({
      nome: '  Ana  ',
      documento: '529.982.247-25',
      tipoDocumento: TipoDocumento.CPF,
      telefone: '11999999999',
      email: ' ANA@EXAMPLE.COM ',
    });

    expect(cadastrar).toHaveBeenCalledWith({
      nome: 'Ana',
      documento: '52998224725',
      tipoDocumento: TipoDocumento.CPF,
      telefone: '11999999999',
      email: 'ana@example.com',
    });
  });

  it('rejeita documento inválido sem acessar o repositório', () => {
    expect(() =>
      useCase.execute({
        nome: 'Ana',
        documento: '11111111111',
        tipoDocumento: TipoDocumento.CPF,
        telefone: '11999999999',
        email: 'ana@example.com',
      }),
    ).toThrow(BadRequestException);
    expect(cadastrar).not.toHaveBeenCalled();
  });
});
