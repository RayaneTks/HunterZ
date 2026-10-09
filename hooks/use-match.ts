'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getMatch, matchAction, type MatchSnapshot } from '../lib/match';
export function useMatch(roomId:string|null) {
 const [match,setMatch]=useState<MatchSnapshot|null>(null);const [available,setAvailable]=useState(false);
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [fresh,setFresh]=useState(false);
 const sequence=useRef(0);const applied=useRef(0);const activeRoom=useRef(roomId);activeRoom.current=roomId;
 const lastSuccess=useRef(0);
 const accept=useCallback((data:MatchSnapshot|null,seq:number,room:string)=>{if(activeRoom.current!==room||seq<applied.current)return;applied.current=seq;setMatch(data);setAvailable(true);lastSuccess.current=Date.now();setFresh(true);},[]);
 useEffect(()=>{
  setMatch(null);setAvailable(false);setFresh(false);setError('');lastSuccess.current=0;
  if(!roomId)return;
  let cancelled=false,pending=false;
  const refresh=async()=>{
   if(pending||cancelled||document.visibilityState==='hidden')return;pending=true;const seq=++sequence.current;
   try{const next=await getMatch(roomId);if(!cancelled){accept(next,seq,roomId);setError('');}}
   catch(e){if(!cancelled){setFresh(false);if(lastSuccess.current)setError('Connexion interrompue. Les actions attendent le retour du serveur.');}}
   finally{pending=false;}
  };
  void refresh();const timer=window.setInterval(()=>{if(Date.now()-lastSuccess.current>15000)setFresh(false);void refresh();},5000);
  document.addEventListener('visibilitychange',refresh);window.addEventListener('online',refresh);
  return()=>{cancelled=true;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('online',refresh);};
 },[roomId,accept]);
 const act=async(action:string,options:{target?:string;ready?:boolean;request?:string}={})=>{
  if(!roomId||busy)return;setBusy(true);setError('');const seq=++sequence.current;
  try{accept(await matchAction(roomId,action,options),seq,roomId);}
  catch(e){setError(e&&typeof e==='object'&&'message'in e?String(e.message):'Action indisponible. Réessaie.');}
  finally{setBusy(false);}
 };
 return{match,available,fresh,busy,error,act};
}
