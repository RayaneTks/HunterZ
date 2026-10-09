const {test}=require('node:test');const assert=require('node:assert/strict');
const {setup,as,act,fix,start,ids,room}=require('./helpers/match-db.cjs');
test('La Piste runs server rules and protects target coordinates',async()=>{const db=await setup();try{

 await as(db,2);await assert.rejects(act(db,'create',{target:ids[1]}),/hôte/);

 await as(db,0);let match=await act(db,'create',{target:ids[1]});assert.equal(match.state,'briefing');

 await assert.rejects(act(db,'start'),/prêts|GPS/);

 for(let i=0;i<4;i++){await fix(db,i);await act(db,'ready',{ready:true});}

 await as(db,0);const actionId=crypto.randomUUID();match=await act(db,'start',{actionId});assert.equal(match.state,'running');const revision=match.revision;assert.equal((await act(db,'start',{actionId})).revision,revision);

 const hunterRaw=(await db.query('select user_id from match_positions')).rows;assert.equal(hunterRaw.length,3);assert.ok(!hunterRaw.some(p=>p.user_id===ids[1]));

 assert.equal((await db.query('select * from positions')).rows.length,0);

 await assert.rejects(db.query('insert into positions values($1,$2,43,5,8,now())',[room,ids[0]]),/row-level security|publish_location/);

 await as(db,1);assert.equal((await db.query('select user_id from match_positions')).rows.length,1);

 await assert.rejects(act(db,'start'),/hôte/);

 await assert.rejects(act(db,'extract'),/dix minutes|avance/);

 await as(db,0);await act(db,'pause');assert.equal((await act(db,'resume')).state,'running');

 await db.exec('reset role');await db.exec("update hunt_matches set elapsed_seconds=121,segment_started_at=now();");await fix(db,1);

 await as(db,2);match=(await db.query('select get_match($1) as match',[room])).rows[0].match;assert.ok(match.clue);assert.equal(match.clue.cellSize,200);assert.equal(match.locations.some(p=>p.user_id===ids[1]),false);assert.ok(!JSON.stringify(match.clue).includes('accuracy'));

 const capture=await act(db,'capture');assert.ok(capture.capture.id);const request=capture.capture.id;

 await assert.rejects(act(db,'confirm',{request}),/cible/);

 await as(db,1);match=await act(db,'confirm',{request});assert.equal(match.state,'finished');assert.equal(match.result.winner,'hunters');

 await db.exec('reset role');assert.equal((await db.query('select * from match_positions')).rows.length,0);

 await as(db,0);assert.equal((await act(db,'create',{target:ids[2]})).state,'briefing');

 }finally{await db.close();}});

test('timeout has one result and disconnect cancels match',async()=>{const db=await setup();try{await start(db);await db.exec('reset role');await db.exec('update hunt_matches set elapsed_seconds=901,segment_started_at=now()');await as(db,0);let m=(await db.query('select get_match($1) as match',[room])).rows[0].match;assert.equal(m.result.reason,'timeout');await act(db,'create',{target:ids[1]});await as(db,3);await db.query('select leave_room($1)',[room]);await as(db,0);m=(await db.query('select get_match($1) as match',[room])).rows[0].match;assert.equal(m.state,'cancelled');}finally{await db.close();}});

test('finished match never republishes pending target GPS to lobby',async()=>{const db=await setup();try{await start(db);await db.exec('reset role');await db.exec('update hunt_matches set elapsed_seconds=901,segment_started_at=now()');await as(db,0);await db.query('select get_match($1)',[room]);await fix(db,1);await db.exec('reset role');assert.equal((await db.query('select * from positions')).rows.length,0);}finally{await db.close();}});
test('technical pause stops clock at signal deadline and extraction needs two fixes',async()=>{const db=await setup();try{await start(db);await db.exec('reset role');await db.exec("update hunt_matches set segment_started_at=now()-interval '120 seconds'; update match_positions set last_good_at=now()-interval '120 seconds',updated_at=now()-interval '120 seconds' where user_id='20000000-0000-4000-8000-000000000002'");await as(db,0);let m=(await db.query('select get_match($1) as match',[room])).rows[0].match;assert.equal(m.state,'paused');assert.ok(m.elapsedSeconds>=89&&m.elapsedSeconds<=91,`elapsed ${m.elapsedSeconds}`);
 for(let i=0;i<4;i++)await fix(db,i);await as(db,0);await act(db,'resume');await db.exec('reset role');await db.exec('update hunt_matches set elapsed_seconds=600,segment_started_at=now()');await fix(db,1);await assert.rejects(act(db,'extract'),/cinq secondes/);await db.exec('reset role');await db.exec("update match_positions set extraction_since=now()-interval '6 seconds' where user_id='20000000-0000-4000-8000-000000000002'");await fix(db,1);m=await act(db,'extract');assert.equal(m.result.winner,'target');assert.equal(m.result.reason,'extraction');}finally{await db.close();}});
test('late polling honours earlier signal deadline instead of awarding timeout',async()=>{const db=await setup();try{await start(db);await db.exec('reset role');await db.exec("update hunt_matches set segment_started_at=now()-interval '1000 seconds'; update match_positions set last_good_at=now()-interval '1000 seconds',updated_at=now()-interval '1000 seconds' where user_id='20000000-0000-4000-8000-000000000002'");await as(db,0);const m=(await db.query('select get_match($1) as match',[room])).rows[0].match;assert.equal(m.state,'paused');assert.equal(m.result,null);assert.ok(m.elapsedSeconds<91);}finally{await db.close();}});
test('delayed confirmation cannot confirm another match role',async()=>{const db=await setup();try{await as(db,0);const old=await act(db,'create',{target:ids[1]});await act(db,'cancel');const next=await act(db,'create',{target:ids[2]});await as(db,1);await assert.rejects(db.query('select hunt_match_action($1,$2,null,true,null,$3,$4)',[room,'ready',crypto.randomUUID(),old.id]),/Manche remplacée/);await as(db,0);const m=(await db.query('select get_match($1) as match',[room])).rows[0].match;assert.equal(m.id,next.id);assert.equal(m.roster.find(p=>p.user_id===ids[1]).ready,false);}finally{await db.close();}});
test('bad accuracy cannot refresh admissible target signal deadline',async()=>{const db=await setup();try{await start(db);await db.exec('reset role');await db.exec("update hunt_matches set segment_started_at=now()-interval '120 seconds';update match_positions set accuracy=100,updated_at=now() where user_id='20000000-0000-4000-8000-000000000002'");const has=(await db.query("select 1 from information_schema.columns where table_name='match_positions' and column_name='last_good_at'")).rows.length;if(has)await db.exec("update match_positions set last_good_at=now()-interval '120 seconds' where user_id='20000000-0000-4000-8000-000000000002'");await as(db,0);const m=(await db.query('select get_match($1) as match',[room])).rows[0].match;assert.equal(m.state,'paused');assert.equal(m.result,null);}finally{await db.close();}});
