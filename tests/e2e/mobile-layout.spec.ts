import { expect, test } from '@playwright/test';
for (const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]) {
  test(`entry readable and touchable ${size.width}`, async ({page}) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await expect(page.getByLabel('Ton pseudo')).toBeVisible();
    await expect(page.getByRole('button', {name:'Découvrir', exact:true})).toBeVisible();
    const viewport = await page.locator('meta[name=viewport]').getAttribute('content');
    expect(viewport).not.toContain('user-scalable=no');
    expect(viewport).not.toContain('maximum-scale=1');
    const primary = page.getByRole('button',{name:'Entrer dans HUNT'});
    const rect = await primary.boundingBox();
    expect(rect!.height).toBeGreaterThanOrEqual(48);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.evaluate(()=>document.documentElement.style.fontSize='200%');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const notice = page.locator('.release-notice');
    for (const control of [notice.getByRole('button', {name:'Découvrir', exact:true}), notice.getByRole('button', {name:'Fermer l’avis de version'})]) {
      const bounds = await control.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(size.width);
    }
  });
}
