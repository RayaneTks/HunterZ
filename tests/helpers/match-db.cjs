const fs=require('node:fs');const {PGlite}=require('@electric-sql/pglite');

const ids=['10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000004'];

const room='50000000-0000-4000-8000-000000000005';

async function setup(){const db=new PGlite();await db.exec(`create schema auth; create table auth.users(id uuid primary key); create role authenticated; create role anon; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; create publication supabase_realtime;`);await db.exec(fs.readFileSync('supabase/schema.sql','utf8').replace('create extension if not exists pgcrypto;',''));await db.exec('grant usage on schema public to authenticated; grant select,insert,update,delete on profiles,rooms,room_members,positions to authenticated;');for(let i=0;i<4;i++){await db.query('insert into auth.users values($1)',[ids[i]]);await db.query('insert into profiles(id,nickname) values($1,$2)',[ids[i],`Joueur${i}`]);}await db.query(`insert into rooms(id,code,owner_id,zone_center_lat,zone_center_lng,zone_radius_m) values($1,'HUNT01',$2,43.2965,5.3698,500)`,[room,ids[0]]);for(const id of ids)await db.query('insert into room_members(room_id,user_id) values($1,$2)',[room,id]);return db;}

async function as(db,index){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[index]]);await db.exec('set role authenticated');}

async function act(db,action,args={}){return (await db.query('select hunt_match_action($1,$2,$3,$4,$5,$6) as match',[room,action,args.target||null,args.ready??null,args.request||null,args.actionId||crypto.randomUUID()])).rows[0].match;}

async function fix(db,index){await as(db,index);await db.query('select publish_location($1,43.2965,5.3698,8)',[room]);}

async function start(db){await as(db,0);await act(db,'create',{target:ids[1]});for(let i=0;i<4;i++){await fix(db,i);await act(db,'ready',{ready:true});}await as(db,0);return act(db,'start');}


module.exports={setup,as,act,fix,start,ids,room};
