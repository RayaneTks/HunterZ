import { test, expect, type BrowserContext } from '@playwright/test';
const {setup,as,ids,room}=require('../helpers/match-db.cjs');
test('four players confirm roles, start, intercept and rematch through PostgreSQL',async({browser})=>{
 const db=await setup();const contexts:BrowserContext[]=[];let chain=Promise.resolve();
 const serial=<T,>(run:()=>Promise<T>):Promise<T>=>{const next=chain.then(run);chain=next.then(()=>{},()=>{});return next;};
 try{
 for(let i=0;i<4;i++){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,permissions:['geolocation'],geolocation:{latitude:43.2965,longitude:5.3698,accuracy:8}});contexts.push(context);
  await context.addInitScript(({room,owner})=>localStorage.setItem('hunt:active-room',JSON.stringify({id:room,code:'HUNT01',owner_id:owner})),{room,owner:ids[0]});
  await context.routeWebSocket(/.*/,socket=>socket.close());
  await context.route('**/auth/v1/signup**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({access_token:`player-${i}`,token_type:'bearer',expires_in:3600,refresh_token:`refresh-${i}`,user:{id:ids[i],aud:'authenticated',role:'authenticated',is_anonymous:true,app_metadata:{provider:'anonymous'},user_metadata:{},created_at:new Date().toISOString()}})}));
  await context.route('https://basemaps.cartocdn.com/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({version:8,sources:{},layers:[]})}));
  await context.route('**/rest/v1/**',async route=>{
   const request=route.request();const path=new URL(request.url()).pathname.replace('/rest/v1/','');const body=request.postData()?request.postDataJSON():{};
   const result=await serial(async()=>{await as(db,i);try{
    if(path==='profiles')return (await db.query('select id,nickname from profiles where id=$1',[ids[i]])).rows;
    if(path==='rooms')return (await db.query('select * from rooms where id=$1',[room])).rows;
    if(path==='room_members')return (await db.query("select user_id,jsonb_build_object('nickname',profiles.nickname) as profiles from room_members join profiles on profiles.id=room_members.user_id where room_id=$1",[room])).rows;
    if(path==='positions')return (await db.query('select * from positions where room_id=$1',[room])).rows;
    if(path==='rpc/get_match')return (await db.query('select get_match($1) as value',[body.p_room])).rows[0].value;
    if(path==='rpc/hunt_match_action')return (await db.query('select hunt_match_action($1,$2,$3,$4,$5,$6) as value',[body.p_room,body.p_action,body.p_target,body.p_ready,body.p_request,body.p_action_id])).rows[0].value;
    if(path==='rpc/publish_location'){await db.query('select publish_location($1,$2,$3,$4)',[body.p_room_id,body.p_latitude,body.p_longitude,body.p_accuracy]);return null;}
    if(path==='rpc/stop_sharing'){await db.query('select stop_sharing($1)',[body.p_room]);return null;}
    throw new Error(`Unhandled ${path}`);
   }catch(e){return {failure:true,message:String((e as Error).message)};}});
   await route.fulfill({status:result?.failure?400:200,contentType:'application/json',body:JSON.stringify(result)});
  });
 }
 const pages=await Promise.all(contexts.map(c=>c.newPage()));await Promise.all(pages.map(p=>p.goto('/')));
 await pages[0].getByRole('button',{name:/Développer le panneau/}).click();
 await pages[0].getByLabel('Qui veut jouer la cible ?').selectOption(ids[1]);await pages[0].getByRole('button',{name:'Préparer la manche'}).click();
 for(let i=0;i<4;i++){
  await expect(pages[i].getByRole('heading',{name:i===1?'Tu es la cible.':'Tu es chasseur.'})).toBeVisible();
  await pages[i].getByRole('button',{name:'Activer le GPS'}).click();await pages[i].getByRole('button',{name:'Continuer vers l’autorisation'}).click();
  const ready=pages[i].getByRole('button',{name:i===1?'J’accepte de jouer la cible':'Je suis prêt'});await expect(ready).toBeEnabled();await ready.click();
 }
 await expect(pages[0].getByRole('button',{name:'Lancer la manche'})).toBeEnabled();await pages[0].getByRole('button',{name:'Lancer la manche'}).click();
 await expect(pages[0].getByRole('heading',{name:'La piste arrive.'})).toBeVisible();
 await serial(async()=>{await db.exec('reset role');await db.exec('update hunt_matches set elapsed_seconds=40,segment_started_at=now()');});
 for(let i=0;i<4;i++)await contexts[i].setGeolocation({latitude:43.2965+i*.000001,longitude:5.3698,accuracy:8});
 await expect(pages[2].getByRole('button',{name:'Cible rencontrée'})).toBeEnabled();await pages[2].getByRole('button',{name:'Cible rencontrée'}).click();await pages[2].getByRole('button',{name:'Confirmer',exact:true}).click();
 await expect(pages[1].getByRole('button',{name:'Confirmer la rencontre'})).toBeVisible();await pages[1].getByRole('button',{name:'Confirmer la rencontre'}).click();
 for(const page of pages)await expect(page.getByRole('heading',{name:'L’équipe l’emporte.'})).toBeVisible();
 await pages[0].getByLabel('Qui veut jouer la cible ?').selectOption(ids[2]);await pages[0].getByRole('button',{name:'Préparer la manche'}).click();
 await expect(pages[2].getByRole('heading',{name:'Tu es la cible.'})).toBeVisible();await expect(pages[2].getByRole('button',{name:'J’accepte de jouer la cible'})).toBeDisabled();
 }finally{await Promise.all(contexts.map(c=>c.close()));await chain;await db.close();}
});
