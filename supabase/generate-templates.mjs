import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('./templates/', import.meta.url);
const base = readFileSync(new URL('confirmation.html', root), 'utf8');
const templates = {
  invite: [
    'Você foi convidado',
    'Você recebeu um convite para acompanhar seus treinos. Aceite para continuar.',
    'Aceitar convite',
  ],
  recovery: [
    'Redefina sua senha',
    'Recebemos uma solicitação para redefinir sua senha. Use o botão abaixo para escolher uma nova senha.',
    'Redefinir minha senha',
  ],
  magic_link: [
    'Seu link de acesso',
    'Use o botão abaixo para acessar sua conta com segurança.',
    'Entrar na minha conta',
  ],
  email_change: [
    'Confirme seu novo email',
    'Recebemos uma solicitação para alterar o email da sua conta para {{ .NewEmail }}. Confirme para continuar.',
    'Confirmar alteração de email',
  ],
  reauthentication: [
    'Confirme sua identidade',
    'Use este código para confirmar sua identidade: <strong>{{ .Token }}</strong>. Não compartilhe este código.',
  ],
  password_changed_notification: [
    'Sua senha foi alterada',
    'A senha da sua conta foi alterada. Se você não reconhece essa alteração, redefina sua senha pelo aplicativo.',
  ],
  email_changed_notification: [
    'Seu email foi alterado',
    'O email da sua conta foi alterado de {{ .OldEmail }} para {{ .Email }}. Se você não reconhece essa alteração, entre em contato com o suporte.',
  ],
  phone_changed_notification: [
    'Seu telefone foi alterado',
    'O telefone da sua conta foi alterado. Se você não reconhece essa alteração, entre em contato com o suporte.',
  ],
  identity_linked_notification: [
    'Método de acesso adicionado',
    'Um método de acesso foi vinculado à sua conta. Se você não reconhece essa alteração, entre em contato com o suporte.',
  ],
  identity_unlinked_notification: [
    'Método de acesso removido',
    'Um método de acesso foi removido da sua conta. Se você não reconhece essa alteração, entre em contato com o suporte.',
  ],
  mfa_factor_enrolled_notification: [
    'Verificação em duas etapas adicionada',
    'Um método de verificação em duas etapas foi adicionado à sua conta. Se você não reconhece essa alteração, entre em contato com o suporte.',
  ],
  mfa_factor_unenrolled_notification: [
    'Verificação em duas etapas removida',
    'Um método de verificação em duas etapas foi removido da sua conta. Se você não reconhece essa alteração, entre em contato com o suporte.',
  ],
};
const subjects = { confirmation: 'Confirme seu email | Hypertrophy Tracker' };
for (const [key, [title, body, button]] of Object.entries(templates)) {
  let html = base
    .replace(
      /<title>.*?<\/title>/,
      `<title>${title} | Hypertrophy Tracker</title>`,
    )
    .replace(
      'Confirme seu email para começar a acompanhar seus treinos.',
      `${title}.`,
    )
    .replace('Seu próximo nível começa aqui.', `${title}.`)
    .replace(
      /Confirme seu email para ativar sua conta e acompanhar seus\s+treinos, sua progressão e seus resultados\./,
      body,
    )
    .replace(
      'Se você não criou esta conta, pode ignorar este email.',
      'Se você não solicitou esta ação, não compartilhe códigos nem encaminhe este email.',
    );
  if (button) html = html.replace('Confirmar meu email', button);
  else {
    const start = html.indexOf(
      '                <table role="presentation" cellspacing="0" cellpadding="0">',
    );
    const end = html.indexOf(
      '              </td>',
      html.indexOf('                </table>', start) +
        '                </table>'.length,
    );
    html = html.slice(0, start) + html.slice(end);
  }
  writeFileSync(new URL(`${key}.html`, root), html);
  subjects[key] = `${title} | Hypertrophy Tracker`;
}
writeFileSync(
  new URL('subjects.json', root),
  JSON.stringify(subjects, null, 2) + '\n',
);
