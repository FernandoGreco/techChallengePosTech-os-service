import { OrdemServico, TransicaoStatusInvalidaError } from './ordem-servico';
import { StatusOS } from './status-os';

describe('OrdemServico', () => {
  const abrirOS = () =>
    OrdemServico.abrir({
      id: 'os-1',
      clienteId: 'cliente-1',
      veiculoId: 'veiculo-1',
      criadaEm: new Date('2026-01-01T10:00:00.000Z'),
    });

  it('abre uma OS com status RECEBIDA', () => {
    const os = abrirOS();

    expect(os.status).toBe(StatusOS.RECEBIDA);
  });

  it('registra uma transição válida e atualiza o status', () => {
    const os = abrirOS();
    const ocorridaEm = new Date('2026-01-01T11:00:00.000Z');

    const transicao = os.transicionar(StatusOS.EM_DIAGNOSTICO, ocorridaEm);

    expect(transicao).toEqual({
      statusAnterior: StatusOS.RECEBIDA,
      statusNovo: StatusOS.EM_DIAGNOSTICO,
      ocorridaEm,
    });
    expect(os.status).toBe(StatusOS.EM_DIAGNOSTICO);
  });

  it('permite retornar ao diagnóstico quando o orçamento é recusado', () => {
    const os = abrirOS();
    os.transicionar(StatusOS.EM_DIAGNOSTICO);
    os.transicionar(StatusOS.AGUARDANDO_APROVACAO);

    os.transicionar(StatusOS.EM_DIAGNOSTICO);

    expect(os.status).toBe(StatusOS.EM_DIAGNOSTICO);
  });

  it('rejeita uma transição inválida sem alterar o status', () => {
    const os = abrirOS();

    expect(() => os.transicionar(StatusOS.EM_EXECUCAO)).toThrow(
      TransicaoStatusInvalidaError,
    );
    expect(os.status).toBe(StatusOS.RECEBIDA);
  });

  it('rejeita identificadores vazios', () => {
    expect(() =>
      OrdemServico.abrir({
        id: 'os-1',
        clienteId: ' ',
        veiculoId: 'veiculo-1',
      }),
    ).toThrow('clienteId é obrigatório');
  });
});
