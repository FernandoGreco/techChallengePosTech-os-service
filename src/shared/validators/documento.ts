export const TipoDocumento = {
  CPF: 'CPF',
  CNPJ: 'CNPJ',
} as const;

export type TipoDocumento = (typeof TipoDocumento)[keyof typeof TipoDocumento];

export function normalizarDocumento(documento: string): string {
  return documento.replace(/\D/g, '');
}

export function documentoValido(
  tipo: TipoDocumento,
  documento: string,
): boolean {
  const normalizado = normalizarDocumento(documento);

  if (tipo === TipoDocumento.CPF) {
    return cpfValido(normalizado);
  }
  return cnpjValido(normalizado);
}

export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const calcularDigito = (base: string, pesoInicial: number): number => {
    const soma = [...base].reduce(
      (total, digito, indice) =>
        total + Number(digito) * (pesoInicial - indice),
      0,
    );
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return (
    calcularDigito(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    calcularDigito(cpf.slice(0, 10), 11) === Number(cpf[10])
  );
}

function cnpjValido(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) {
    return false;
  }

  const calcularDigito = (base: string): number => {
    const pesos =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = [...base].reduce(
      (total, digito, indice) => total + Number(digito) * pesos[indice],
      0,
    );
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return (
    calcularDigito(cnpj.slice(0, 12)) === Number(cnpj[12]) &&
    calcularDigito(cnpj.slice(0, 13)) === Number(cnpj[13])
  );
}
