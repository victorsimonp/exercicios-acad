import { test, expect } from '@playwright/test';
test('cadastro, execução, persistência e histórico', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Atleta E2E');
  await page
    .getByLabel('Email', { exact: true })
    .fill(`e2e-${crypto.randomUUID()}@example.invalid`);
  await page.getByLabel('Senha', { exact: true }).fill('Senha-E2E-12345');
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await expect(
    page.getByRole('heading', { name: 'Vamos evoluir, Atleta.' }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('dashboard.png'),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole('link', { name: 'Iniciar treino', exact: true })
    .last()
    .click();
  await page
    .getByRole('heading', { name: 'Peito e Tríceps', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Iniciar treino', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Treino em andamento' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Pular aquecimento', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Confirmar e ocultar aquecimento' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Pular aquecimento', exact: true }),
  ).toHaveCount(0);
  const first = page.locator('.session-exercise').first();
  const work = first
    .locator('.set-block')
    .filter({ hasText: 'Trabalho' })
    .first();
  await work.getByRole('spinbutton', { name: /Carga série/ }).fill('40');
  await work.getByRole('spinbutton', { name: /Repetições série/ }).fill('10');
  await work.getByRole('spinbutton', { name: /RIR série/ }).fill('2');
  await work
    .getByRole('button', { name: 'Concluir série', exact: true })
    .click();
  await expect(work.getByText('Salvo', { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Pular aquecimento', exact: true }),
  ).toHaveCount(0);
  await expect(
    first
      .locator('.set-block')
      .filter({ hasText: 'Trabalho' })
      .first()
      .getByRole('spinbutton', { name: /Carga série/ }),
  ).toHaveValue('40');
  await page.screenshot({
    path: testInfo.outputPath('session.png'),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole('button', { name: 'Finalizar treino', exact: true })
    .click();
  await page.getByRole('button', { name: 'Concluir e salvar' }).click();
  await expect(
    page.getByRole('heading', { name: 'Treino concluído.' }),
  ).toBeVisible();
  await expect(
    page.getByText(/Histórico insuficiente ou séries incompletas/).first(),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Ver histórico', exact: true }).click();
  await expect(
    page.getByRole('cell', { name: '400 kg', exact: true }),
  ).toBeVisible();
  await page.goto('/exercicios');
  await page
    .getByRole('textbox', { name: 'Buscar exercício' })
    .fill('Supino inclinado smith');
  await expect(page.locator('.catalog-item')).toHaveCount(1);
  await page.goto('/periodizacao');
  await expect(page.getByText('DELOAD', { exact: true })).toBeVisible();
  await page.goto('/evolucao');
  await expect(
    page.getByRole('heading', { name: 'Sua evolução', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('personaliza ficha, agenda e configura o ciclo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Atleta E2E');
  await page
    .getByLabel('Email', { exact: true })
    .fill(`e2e-${crypto.randomUUID()}@example.invalid`);
  await page.getByLabel('Senha', { exact: true }).fill('Senha-E2E-12345');
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await expect(
    page.getByRole('heading', { name: 'Vamos evoluir, Atleta.' }),
  ).toBeVisible();
  await page.goto('/treinos');
  await page
    .getByRole('heading', { name: 'Peito e Tríceps', exact: true })
    .click();
  await page
    .getByRole('button', {
      name: 'Editar Supino inclinado smith banco 30°',
      exact: true,
    })
    .click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Séries', { exact: true }).fill('4');
  await dialog.getByRole('button', { name: 'Salvar alteração' }).click();
  await expect(page.getByText(/4 séries-alvo/).first()).toBeVisible();
  await page
    .getByRole('button', { name: 'Adicionar exercício', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Buscar exercício', { exact: true })
    .fill('Rosca direta barra W');
  await dialog
    .getByRole('listbox', { name: 'Exercício', exact: true })
    .selectOption({ label: 'Rosca direta barra W' });
  await dialog.getByRole('button', { name: 'Salvar alteração' }).click();
  await expect(page.locator('.exercise-item')).toHaveCount(5);
  await page
    .getByRole('button', { name: 'Mover para cima', exact: true })
    .last()
    .click();
  await expect(
    page
      .locator('.exercise-item')
      .nth(3)
      .getByRole('heading', { name: 'Rosca direta barra W', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Remover Rosca direta barra W', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Remover exercício', exact: true })
    .click();
  await expect(page.locator('.exercise-item')).toHaveCount(4);
  await page.goto('/treinos');
  await page.getByRole('button', { name: 'Agendar', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Data', { exact: true }).fill('2026-11-06');
  await dialog.getByRole('button', { name: 'Salvar agendamento' }).click();
  await expect(page.locator('.schedule-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Reagendar', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Data', { exact: true }).fill('2026-11-07');
  await dialog.getByRole('button', { name: 'Salvar agendamento' }).click();
  await expect(page.getByText('Reagendado de', { exact: false })).toBeVisible();
  await page.goto('/periodizacao');
  await page.getByRole('button', { name: 'Editar ciclo', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Séries semana 8', { exact: true }).fill('2');
  await dialog
    .getByRole('button', { name: 'Salvar ciclo', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/configuracoes');
  await page.getByLabel('Nome', { exact: true }).fill('Atleta E2E');
  await page
    .getByRole('combobox', { name: 'Aparência', exact: true })
    .selectOption('light');
  await page
    .getByRole('button', { name: 'Salvar preferências', exact: true })
    .click();
  await expect(
    page.getByText('Preferências salvas.', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
