import { expect,test } from '@playwright/test';
test('main entry action stays visible on small phones',async({page})=>{await page.setViewportSize({width:320,height:568});await page.goto('/');const button=page.getByRole('button',{name:'Entrer dans HUNT'});await expect(button).toBeVisible();const box=await button.boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(568);});
