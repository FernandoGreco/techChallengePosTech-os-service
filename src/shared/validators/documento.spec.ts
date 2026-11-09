import {
  cpfValido,
  documentoValido,
  normalizarDocumento,
  TipoDocumento,
} from './documento';

describe('validadores de documento', () => {
  it('normaliza documentos com pontuação', () => {
    expect(normalizarDocumento('123.456.789-09')).toBe('12345678909');
  });

  it('valida CPF e rejeita sequências e dígitos incorretos', () => {
    expect(cpfValido('52998224725')).toBe(true);
    expect(cpfValido('11111111111')).toBe(false);
    expect(cpfValido('52998224724')).toBe(false);
  });

  it('valida CNPJ conforme o tipo de documento informado', () => {
    expect(documentoValido(TipoDocumento.CNPJ, '11.222.333/0001-81')).toBe(
      true,
    );
    expect(documentoValido(TipoDocumento.CPF, '11.222.333/0001-81')).toBe(
      false,
    );
  });
});
