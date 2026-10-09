import { expect, test } from '@playwright/test';
test('entry communicates how to play before requesting location', async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Dehors. Ensemble.'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Comment jouer'})).toBeVisible();
 await page.getByRole('button',{name:'Comment jouer'}).click();
 await expect(page.getByRole('dialog',{name:'La Piste'})).toBeVisible();
 await page.getByRole('button',{name:'Fermer les règles'}).click();
 await expect(page.getByLabel('Ton pseudo')).toBeVisible();
});
