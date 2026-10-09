/* Native, independent PostgreSQL connections: join/leave against uncommitted match creation.
   HUNT_PG_TOOL_ROOT points to isolated tools containing @embedded-postgres/windows-x64 and pg. */
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const {spawnSync}=require('node:child_process');const {pathToFileURL}=require('node:url');
const {setup,ids,room}=require('../tests/helpers/match-db.cjs');
(async()=>{
 const tool=path.resolve(process.env.HUNT_PG_TOOL_ROOT||'../../.hunt-tools/pg-concurrency');const {Client}=require(path.join(tool,'node_modules/pg'));
 const binaries=await import(pathToFileURL(path.join(tool,'node_modules/@embedded-postgres/windows-x64/dist/index.js')));
 const data=path.join(tool,'data');const options={host:'127.0.0.1',port:20139,user:'hunt_test',database:'postgres'};let running=false;let control;const failures=[];
 function command(file,args){const result=spawnSync(file,args,{stdio:'ignore',windowsHide:true});if(result.status!==0)throw new Error(result.stderr||result.stdout||`Exit ${result.status}`);}
 try{
  if(!fs.existsSync(path.join(data,'PG_VERSION')))command(binaries.initdb,['-D',data,'-U','hunt_test','--auth=trust','--no-locale','--encoding=UTF8']);
  command(binaries.pg_ctl,['-D',data,'-l',path.join(tool,'postgres.log'),'-o','-h 127.0.0.1 -p 20139','-w','start']);running=true;
  control=new Client(options);await control.connect();
  for(const mode of ['join','leave']){
   const database=`hunt_race_${mode}_${Date.now()}`;const clients=[];
   try{
    await control.query('drop role if exists authenticated;drop role if exists anon;');await control.query(`create database ${database}`);
    const root=new Client({...options,database});clients.push(root);await root.connect();await setup({db:{exec:sql=>root.query(sql),query:(sql,params)=>root.query(sql,params)}});
    const newcomer='60000000-0000-4000-8000-000000000006';if(mode==='join'){await root.query('insert into auth.users values($1)',[newcomer]);await root.query("insert into profiles(id,nickname) values($1,'Nouveau')",[newcomer]);}
    const host=new Client({...options,database,application_name:'hunt-race-create'});const member=new Client({...options,database,application_name:'hunt-race-member'});clients.push(host,member);await host.connect();await member.connect();
    for(const [client,id] of [[host,ids[0]],[member,mode==='join'?newcomer:ids[3]]]){await client.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await client.query('set role authenticated');}
    await host.query('begin');await host.query("select hunt_match_action($1,'create',$2,null,null,$3,null)",[room,ids[1],crypto.randomUUID()]);
    let settled=false;const mutation=member.query(mode==='join'?"select join_room('HUNT01')":"select leave_room($1)",mode==='join'?[]:[room]).then(result=>{settled=true;return{ok:true,result};},error=>{settled=true;return{ok:false,message:error.message};});
    const deadline=Date.now()+3000;let waited=false;
    while(!settled&&Date.now()<deadline){const active=(await root.query("select wait_event_type from pg_stat_activity where application_name='hunt-race-member'")).rows[0];if(active?.wait_event_type==='Lock'){waited=true;break;}await new Promise(resolve=>setTimeout(resolve,25));}
    await host.query('commit');const result=await mutation;
    if(mode==='join'){assert.equal(result.ok,false,'Concurrent join entered a frozen match');assert.match(result.message,/manche.*cours/);}
    else{assert.equal(result.ok,true);await root.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[0]]);const match=(await root.query('select get_match($1) as match',[room])).rows[0].match;assert.equal(match.state,'cancelled','Concurrent departure left a frozen departed player');}
    assert.equal(waited,true,'Membership mutation must wait for match-creation room lock');console.log(`${mode}: serialized against uncommitted create — PASS`);
   }catch(error){failures.push(`${mode}: ${error.message}`);console.log(`${mode}: FAIL — ${error.message}`);}
   finally{for(const client of clients){try{await client.query('rollback');await client.end();}catch{}}await control.query(`drop database if exists ${database} with (force)`);}
  }
  if(failures.length)throw new Error(failures.join('\n'));
 }finally{if(control)await control.end();if(running)command(binaries.pg_ctl,['-D',data,'-m','fast','-w','stop']);}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
