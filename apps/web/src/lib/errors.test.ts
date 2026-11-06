import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorMessage } from './errors';

describe('mensagens em português', () => {
  it('traduz os códigos do provedor e oculta erros desconhecidos', () => {
    expect(
      errorMessage({
        code: 'invalid_credentials',
        message: 'Invalid login credentials',
      }),
    ).toBe('Email ou senha incorretos.');
    expect(errorMessage({ code: 'otp_expired' })).toContain('expirado');
    expect(errorMessage({ code: 'over_email_send_rate_limit' })).toContain(
      'limite de envio',
    );
    expect(
      errorMessage({
        name: 'AuthApiError',
        message: 'Internal provider error',
      }),
    ).toBe('Não foi possível concluir a autenticação. Tente novamente.');
    expect(errorMessage(new Error('Failed to fetch'))).toContain(
      'Verifique sua conexão',
    );
  });
  it('preserva mensagens da aplicação e traduz a validação padrão', () => {
    expect(errorMessage(new Error('Registro não encontrado.'))).toBe(
      'Registro não encontrado.',
    );
    const result = z.string().max(3).safeParse('1234');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(errorMessage(result.error)).not.toContain('Too big');
      expect(errorMessage(result.error)).not.toContain('"code"');
    }
  });
});
