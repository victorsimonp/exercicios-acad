import { z } from 'zod';

z.config(z.locales.pt());

const authErrors: Record<string, string> = {
  invalid_credentials: 'Email ou senha incorretos.',
  email_not_confirmed: 'Confirme seu email antes de entrar.',
  user_already_exists: 'Já existe uma conta com esse email.',
  email_exists: 'Já existe uma conta com esse email.',
  user_not_found: 'Conta não encontrada.',
  signup_disabled: 'O cadastro está temporariamente indisponível.',
  email_provider_disabled: 'O acesso por email está indisponível.',
  email_address_invalid: 'Informe um email válido.',
  email_address_not_authorized:
    'O envio para este email ainda não está autorizado. Entre em contato com o suporte.',
  weak_password: 'Escolha uma senha mais forte, com pelo menos 10 caracteres.',
  same_password: 'Escolha uma senha diferente da senha atual.',
  over_email_send_rate_limit:
    'O limite de envio de emails foi atingido. Aguarde e tente novamente.',
  over_request_rate_limit:
    'Muitas tentativas. Aguarde um pouco e tente novamente.',
  otp_expired: 'Link ou código inválido ou expirado. Solicite um novo email.',
  otp_disabled: 'O acesso por código está indisponível.',
  session_not_found: 'Sua sessão expirou. Entre novamente.',
  session_expired: 'Sua sessão expirou. Entre novamente.',
  refresh_token_not_found: 'Sua sessão expirou. Entre novamente.',
  refresh_token_already_used: 'Sua sessão expirou. Entre novamente.',
  bad_jwt: 'Sua sessão é inválida. Entre novamente.',
  flow_state_expired:
    'O link expirou. Solicite um novo email no mesmo navegador.',
  flow_state_not_found:
    'Abra o link no navegador usado para solicitar o email ou solicite um novo link.',
  bad_code_verifier:
    'Abra o link no navegador usado para solicitar o email ou solicite um novo link.',
  validation_failed: 'Confira os dados informados e tente novamente.',
  request_timeout: 'A solicitação demorou demais. Tente novamente.',
  unexpected_failure:
    'Não foi possível concluir a solicitação. Tente novamente.',
  captcha_failed:
    'Não foi possível validar a verificação de segurança. Tente novamente.',
  reauthentication_needed: 'Confirme sua identidade novamente para continuar.',
  reauthentication_not_valid:
    'Código de confirmação inválido. Solicite um novo código.',
};

export function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError)
    return error.issues.map((issue) => issue.message).join(' ');
  const value = error as {
    code?: string;
    message?: string;
    name?: string;
    status?: number;
  } | null;
  if (value?.code && authErrors[value.code]) return authErrors[value.code];
  const message = value?.message ?? '';
  if (/failed to fetch|network|load failed|fetch failed/i.test(message))
    return 'Não foi possível conectar. Verifique sua conexão e tente novamente.';
  if (value?.status === 429)
    return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
  // Provider messages are not localized and may expose internal details.
  if (value?.name?.startsWith('Auth'))
    return 'Não foi possível concluir a autenticação. Tente novamente.';
  if (/invalid login credentials/i.test(message))
    return authErrors.invalid_credentials;
  if (/email not confirmed/i.test(message))
    return authErrors.email_not_confirmed;
  // Preserve the application's Portuguese messages, with a safe fallback for unknown errors.
  if (
    /[áàâãéêíóôõúç]|^(Informe|Use |Erro |Registro |Entre |Link |Confira|Selecione|Preencha|Origem |Requisição |Muitas |Nenhum|Não |Sua |O |A |Os |As )/i.test(
      message,
    )
  )
    return message;
  return 'Não foi possível concluir a solicitação. Tente novamente.';
}
