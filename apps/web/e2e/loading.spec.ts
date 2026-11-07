import { expect, test } from '@playwright/test';

test('inicialização com servidor lento, navegação, falhas e recuperação', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Atleta E2E');
  await page
    .getByLabel('Email', { exact: true })
    .fill(`e2e-${crypto.randomUUID()}@example.invalid`);
  await page.getByLabel('Senha', { exact: true }).fill('Senha-E2E-12345');
  await page
    .getByLabel('Confirmar senha', { exact: true })
    .fill('Senha-E2E-12345');
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await expect(
    page.getByRole('heading', { name: 'Vamos evoluir, Atleta.' }),
  ).toBeVisible();

  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  let mode: 'waiting' | 'server' | 'network' | 'normal' = 'waiting';
  let accountRequests = 0;
  await page.route('**/api/v1/auth/me', async (route) => {
    accountRequests++;
    if (mode === 'waiting') {
      await waiting;
      await route.continue();
    } else if (mode === 'server')
      await route.fulfill({
        status: 503,
        contentType: 'text/html',
        body: 'Unavailable',
      });
    else if (mode === 'network') await route.abort('internetdisconnected');
    else await route.continue();
  });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Seu treinamento' }),
  ).toBeVisible();
  await expect(page.locator('.topbar')).toBeVisible();
  const navigation = page.locator(
    testInfo.project.name === 'mobile' ? '.mobile-nav' : '.sidebar',
  );
  await expect(navigation).toBeVisible();
  await expect(page.locator('.stats-grid .skeleton-value')).toHaveCount(4);
  await expect(page.getByRole('status')).toHaveText(
    /Estamos conectando ao servidor/,
    { timeout: 10000 },
  );
  await expect(
    page.getByRole('heading', { name: 'Vamos evoluir, Atleta.' }),
  ).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('dashboard-loading.png'),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const shell = await page.locator('.app-layout').elementHandle();
  await navigation
    .getByRole('link', {
      name: testInfo.project.name === 'mobile' ? 'treinos' : 'Meus treinos',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Seu treinamento' }),
  ).toBeVisible();
  expect(accountRequests).toBe(1);
  release();
  await expect(
    page.getByRole('heading', { name: 'Meus treinos', exact: true }),
  ).toBeVisible();
  expect(await shell?.evaluate((element) => element.isConnected)).toBe(true);

  for (const failure of ['server', 'network'] as const) {
    mode = failure;
    await page.reload();
    await expect(page.getByRole('alert')).toContainText(
      'Não foi possível carregar suas informações. Tente novamente.',
    );
    await expect(navigation).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Comece seu ciclo.' }),
    ).toHaveCount(0);
    mode = 'normal';
    await page
      .getByRole('button', { name: 'Tentar novamente', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Meus treinos', exact: true }),
    ).toBeVisible();
  }
});
