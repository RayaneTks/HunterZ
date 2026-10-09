import { expect, test } from '@playwright/test';

for (const blockedStorage of [false, true]) {
  test(`release never blocks first visit or invitation, storage blocked=${blockedStorage}`, async ({ page }) => {
    if (blockedStorage) await page.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new Error('Storage unavailable'); };
      Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); };
    });
    await page.goto('/?code=HUNT01');
    await expect(page.getByRole('dialog', { name: /Voici ce qui a changé|mise à jour/ })).toHaveCount(0);
    await page.getByLabel('Ton pseudo').fill('Éclaireur');
    await expect(page.getByRole('button', { name: 'Entrer dans HUNT' })).toBeEnabled();
    await page.getByRole('button', { name: 'Découvrir', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}
