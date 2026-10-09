import {expect,test} from '@playwright/test';
test.beforeEach(async({context})=>{
 await context.route('**/auth/v1/signup**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({access_token:'preview-session',token_type:'bearer',expires_in:3600,refresh_token:'preview-refresh',user:{id:'10000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',is_anonymous:true,app_metadata:{},user_metadata:{}}})}));
 await context.route('**/rest/v1/**',route=>route.fulfill({contentType:'application/json',body:'[]'}));
});
for(const size of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:768,height:1024},{width:1440,height:900},{width:844,height:390}]) {
 test(`production visual ${size.width}x${size.height}`,async({page})=>{await page.setViewportSize(size);await page.goto('/');await expect(page.getByLabel('Ton pseudo')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`docs/validation/2026-10-09/entry-${size.width}.png`,fullPage:true});if(size.width===390||size.width===1440)await page.screenshot({path:`public/screenshots/hunt-${size.width===390?'mobile':'desktop'}.png`});});
}
test('installed shell reloads offline without claiming live GPS',async({page,context})=>{
 await page.goto('/');await expect(page.getByLabel('Ton pseudo')).toBeVisible();await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await page.reload();await expect(page.getByLabel('Ton pseudo')).toBeVisible();
 await context.setOffline(true);await page.reload();await expect(page.getByRole('status').filter({hasText:'Hors ligne'})).toBeVisible();
 const cached=await page.evaluate(async()=>{const keys=await caches.keys();const urls=[];for(const key of keys){for(const req of await(await caches.open(key)).keys())urls.push(req.url);}return urls;});expect(cached.some(url=>url.includes('/rest/v1/')||url.includes('/auth/v1/')||url.includes('release.json'))).toBe(false);
});
test('manifest has a stable identity and dedicated maskable icon',async({request})=>{const manifest=await(await request.get('/manifest.webmanifest')).json();expect(manifest.id).toBe('/');expect(manifest.icons.some((i:{purpose:string;src:string})=>i.purpose==='maskable'&&i.src.includes('maskable'))).toBe(true);expect(manifest.screenshots).toHaveLength(2);});
