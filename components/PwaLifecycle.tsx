'use client';
import { useEffect, useRef, useState } from 'react';
export default function PwaLifecycle() {
 const [offline,setOffline]=useState(false);const [waiting,setWaiting]=useState<ServiceWorker|null>(null);
 const [inMatch,setInMatch]=useState(false);const activeMatch=useRef(false);const [applying,setApplying]=useState(false);const [error,setError]=useState('');
 useEffect(()=>{
  let cancelled=false;let registration:ServiceWorkerRegistration|undefined;
  const online=()=>setOffline(!navigator.onLine);
  const match=(e:Event)=>{activeMatch.current=Boolean((e as CustomEvent).detail);setInMatch(activeMatch.current);};
  const detect=()=>{if(cancelled)return;const pending=registration?.waiting;setWaiting(pending&&navigator.serviceWorker.controller&&pending.scriptURL!==navigator.serviceWorker.controller.scriptURL?pending:null);};
  const status=(e:MessageEvent)=>{if(e.data?.type==='HUNT_UPDATE_CHECK')e.source?.postMessage({type:'HUNT_UPDATE_STATUS',nonce:e.data.nonce,allow:!activeMatch.current});};
  online();window.addEventListener('online',online);window.addEventListener('offline',online);window.addEventListener('hunt:match-active',match);
  if('serviceWorker'in navigator){navigator.serviceWorker.addEventListener('message',status);navigator.serviceWorker.addEventListener('controllerchange',detect);
   const version=JSON.parse(process.env.NEXT_PUBLIC_RELEASE_INFO??'{}').builtAt??'v1';
   navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(version)}`,{updateViaCache:'none'}).then(r=>{
    if(cancelled)return;registration=r;detect();r.addEventListener('updatefound',()=>r.installing?.addEventListener('statechange',detect));
   }).catch(()=>{});
  }
  return()=>{cancelled=true;window.removeEventListener('online',online);window.removeEventListener('offline',online);window.removeEventListener('hunt:match-active',match);if('serviceWorker'in navigator){navigator.serviceWorker.removeEventListener('message',status);navigator.serviceWorker.removeEventListener('controllerchange',detect);}};
 },[]);
 function update(){
  if(!waiting||inMatch)return;setApplying(true);setError('');const channel=new MessageChannel();
  channel.port1.onmessage=e=>{channel.port1.close();if(!e.data?.allowed){setApplying(false);setError('Une manche est ouverte dans un autre onglet. Termine-la avant la mise à jour.');}};
  navigator.serviceWorker.addEventListener('controllerchange',()=>window.location.reload(),{once:true});waiting.postMessage({type:'APPLY_UPDATE'},[channel.port2]);
 }
 return <>{offline&&<p className="connectivity-banner" role="status">Hors ligne · le signal peut être ancien. Reconnecte-toi pour continuer.</p>}{waiting&&<aside className="pwa-update" aria-label="Mise à jour"><span>{inMatch?'Mise à jour disponible après la manche.':'Une nouvelle version est prête.'}</span><button className="button button-soft" onClick={update} disabled={inMatch||applying}>{applying?'Chargement…':'Mettre à jour'}</button>{error&&<p role="status">{error}</p>}</aside>}</>;
}
