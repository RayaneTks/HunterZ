import { expect, test } from '@playwright/test';
test('PWA registers an offline shell without caching private APIs',async({page})=>{
 await page.goto('/');await page.getByLabel('Ton pseudo').waitFor();
 await expect.poll(()=>page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration('/')))).toBe(true);
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 expect(await page.evaluate(async()=>{const names=await caches.keys();return names.some(n=>n.startsWith('hunt-shell-'));})).toBe(true);
});
