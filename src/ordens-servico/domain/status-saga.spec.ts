import { SagaOrquestrada, TransicaoSagaInvalidaError } from './status-saga';
import { StatusSaga } from './status-saga';

describe('SagaOrquestrada', () => {
  it('avança pelo caminho de sucesso até a conclusão', () => {
    const saga = SagaOrquestrada.iniciar('os-1');

    saga.aplicar('DIAGNOSTICO_CONCLUIDO');
    saga.aplicar('ORCAMENTO_GERADO');
    saga.aplicar('ORCAMENTO_APROVADO');
    saga.aplicar('ESTOQUE_RESERVADO');
    saga.aplicar('PAGAMENTO_CONFIRMADO');
    saga.aplicar('EXECUCAO_CONCLUIDA');

    expect(saga.status).toBe(StatusSaga.COMPLETED);
  });

  it('permite reprocessar orçamento recusado antes de nova aprovação', () => {
    const saga = SagaOrquestrada.iniciar('os-1');
    saga.aplicar('DIAGNOSTICO_CONCLUIDO');
    saga.aplicar('ORCAMENTO_GERADO');

    saga.aplicar('ORCAMENTO_RECUSADO');

    expect(saga.status).toBe(StatusSaga.WAITING_FOR_QUOTE);
  });

  it('conclui uma compensação após estoque indisponível', () => {
    const saga = SagaOrquestrada.iniciar('os-1');
    saga.aplicar('DIAGNOSTICO_CONCLUIDO');
    saga.aplicar('ORCAMENTO_GERADO');
    saga.aplicar('ORCAMENTO_APROVADO');
    saga.aplicar('ESTOQUE_INDISPONIVEL');

    saga.aplicar('COMPENSACAO_CONCLUIDA');

    expect(saga.status).toBe(StatusSaga.FAILED);
  });

  it('rejeita eventos fora de sequência sem alterar o estado', () => {
    const saga = SagaOrquestrada.iniciar('os-1');

    expect(() => saga.aplicar('PAGAMENTO_CONFIRMADO')).toThrow(
      TransicaoSagaInvalidaError,
    );
    expect(saga.status).toBe(StatusSaga.STARTED);
  });
});
