import {expect,test} from '@playwright/test';
test('updates wait for every open match and require voluntary activation',async({page,context})=>{
 await context.route('**/auth/v1/**',route=>route.abort());await context.route('**/rest/v1/**',route=>route.abort());
 const other=await context.newPage();await page.goto('/');await other.goto('/');await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await other.evaluate(()=>window.dispatchEvent(new CustomEvent('hunt:match-active',{detail:true})));
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js?v=integration-update');});
 const update=page.getByRole('button',{name:'Mettre à jour'});await expect(update).toBeVisible();
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('hunt:match-active',{detail:true})));await expect(update).toBeDisabled();
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('hunt:match-active',{detail:false})));await update.click();
 await expect(page.getByRole('status').filter({hasText:'autre onglet'})).toBeVisible();await expect(update).toBeEnabled();
 await other.evaluate(()=>window.dispatchEvent(new CustomEvent('hunt:match-active',{detail:false})));await update.click();await expect(page.getByLabel('Ton pseudo')).toBeVisible();
});
