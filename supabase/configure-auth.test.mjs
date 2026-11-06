import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildConfig } from './configure-auth.mjs';

test('configura produção e preserva redirects existentes sem alterar limites ou autenticação', () => {
  const config = buildConfig({
    uri_allow_list: 'https://preview.example.com/auth/callback',
  });
  assert.equal(config.site_url, 'https://treinos-acad.vercel.app');
  assert.ok(
    config.uri_allow_list.includes('https://preview.example.com/auth/callback'),
  );
  assert.ok(
    config.uri_allow_list.includes(
      'https://treinos-acad.vercel.app/auth/redefinir-senha',
    ),
  );
  assert.equal(config.rate_limit_email_sent, undefined);
  assert.equal(config.mailer_autoconfirm, undefined);
});

test('todos os 13 templates têm conteúdo em português e tokens adequados', () => {
  const config = buildConfig({});
  const contents = Object.entries(config).filter(([key]) =>
    key.startsWith('mailer_templates_'),
  );
  assert.equal(contents.length, 13);
  for (const [key, html] of contents) {
    assert.ok(html.includes('lang="pt-BR"'), key);
    assert.ok(!html.includes('localhost'), key);
    assert.equal(
      (html.match(/<table\b/g) ?? []).length,
      (html.match(/<\/table>/g) ?? []).length,
      key,
    );
    if (key.includes('reauthentication'))
      assert.ok(html.includes('{{ .Token }}'));
    else if (!key.includes('notification'))
      assert.ok(html.includes('{{ .ConfirmationURL }}'), key);
    else assert.ok(!html.includes('{{ .ConfirmationURL }}'), key);
  }
  assert.ok(
    config.mailer_templates_recovery_content.includes(
      'Recebemos uma solicitação para redefinir sua senha.',
    ),
  );
});
