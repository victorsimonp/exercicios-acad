import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const project = 'exvcchwfftfafaovkydj';
const site = 'https://treinos-acad.vercel.app';
const root = new URL('./templates/', import.meta.url);
const subjects = JSON.parse(
  readFileSync(new URL('subjects.json', root), 'utf8'),
);
export function buildConfig(current) {
  const redirects = new Set(
    (current.uri_allow_list ?? '').split(',').filter(Boolean),
  );
  for (const origin of [site, 'http://localhost:5173', 'http://127.0.0.1:5173'])
    for (const path of ['/auth/callback', '/auth/redefinir-senha'])
      redirects.add(origin + path);
  const config = {
    site_url: site,
    uri_allow_list: [...redirects].join(','),
    mailer_autoconfirm: true,
  };
  for (const [key, subject] of Object.entries(subjects)) {
    config[`mailer_subjects_${key}`] = subject;
    config[`mailer_templates_${key}_content`] = readFileSync(
      new URL(`${key}.html`, root),
      'utf8',
    );
  }
  return config;
}
async function main() {
  if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify(buildConfig({}), null, 2));
    return;
  }
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token)
    throw new Error(
      'Defina SUPABASE_ACCESS_TOKEN no ambiente local para aplicar as configurações.',
    );
  const endpoint = `https://api.supabase.com/v1/projects/${project}/config/auth`;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  async function request(method = 'GET', body) {
    const response = await fetch(endpoint, {
      method,
      headers,
      body: body && JSON.stringify(body),
    });
    if (!response.ok)
      throw new Error(
        `Não foi possível acessar a configuração de Auth (HTTP ${response.status}).`,
      );
    return response.json();
  }
  const current = await request();
  const config = buildConfig(current);
  // The built-in mail service does not allow increasing its email quota.
  // No undocumented value is used to simulate an unlimited quota.
  await request('PATCH', config);
  const saved = await request();
  for (const [key, value] of Object.entries(config))
    if (saved[key] !== value)
      throw new Error(`A verificação falhou para ${key}.`);
  console.log(
    `Cadastro sem confirmação de email, Site URL, redirects e ${Object.keys(subjects).length} templates aplicados e verificados.`,
  );
  console.log(
    current.smtp_host
      ? 'SMTP próprio detectado. O limite horário deve ser definido conforme a capacidade do provedor; envio ilimitado não foi configurado.'
      : 'Envio padrão do Supabase: o limite de emails permanece. Configure SMTP próprio para aumentar a cota.',
  );
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
