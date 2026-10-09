'use client';
import dynamic from 'next/dynamic';
import { Crosshair, Flag, LogOut, Pause, Play, Radio, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import Brand from './Brand';import Dialog from './Dialog';import MatchBriefing from './MatchBriefing';import MatchResult from './MatchResult';
import type { Member } from '../lib/types';
import type { MatchSnapshot } from '../lib/match';import type { useGeolocation } from '../hooks/use-geolocation';
const MapView=dynamic(()=>import('./MapView'),{ssr:false});
type Props={match:MatchSnapshot;members:Member[];me:string;host:boolean;code:string;busy:boolean;fresh:boolean;error:string;gps:ReturnType<typeof useGeolocation>;onAction:(action:string,options?:{target?:string;ready?:boolean;request?:string})=>Promise<void>;onExit:()=>void};
export default function MatchScreen(p:Props){
 const [consent,setConsent]=useState(false);const [confirm,setConfirm]=useState<'capture'|'extract'|'exit'|'cancel'|null>(null);const [recenter,setRecenter]=useState(0);
 const [displayElapsed,setDisplayElapsed]=useState(p.match.elapsedSeconds);
 const playing=p.match.state==='running'||p.match.state==='paused';const ended=p.match.state==='finished'||p.match.state==='cancelled';
 const disabled=p.busy||!p.fresh;const sharing=p.gps.state==='active'||p.gps.state==='requesting';
 useEffect(()=>{const received=performance.now();const update=()=>setDisplayElapsed(p.match.elapsedSeconds+(p.fresh&&p.match.state==='running'?(performance.now()-received)/1000:0));update();const timer=setInterval(update,1000);return()=>clearInterval(timer);},[p.match,p.fresh]);
 useEffect(()=>{window.dispatchEvent(new CustomEvent('hunt:match-active',{detail:!ended}));return()=>{window.dispatchEvent(new CustomEvent('hunt:match-active',{detail:false}));};},[ended]);
 useEffect(()=>{if(ended)void p.gps.stop();},[ended,p.gps.stop]);
 const remaining=Math.max(0,Math.ceil(900-displayElapsed));const clock=`${Math.floor(remaining/60).toString().padStart(2,'0')}:${(remaining%60).toString().padStart(2,'0')}`;
 return <main className={`match-shell ${playing?'match-playing':''}`}>
 <header className="match-header"><Brand compact/><span className="match-room-code">{p.code}</span><button className="icon-button" aria-label="Quitter la manche" onClick={()=>setConfirm('exit')}><LogOut size={20}/></button></header>
 {p.error&&<p className="match-error" role="alert">{p.error}</p>}{!p.fresh&&<p className="match-error" role="status">Reconnexion… Les actions attendent le serveur.</p>}
 {!ended&&<div className="match-beacon"><Radio size={16}/><span>{sharing?`Balise ${p.gps.accuracy==null?'en attente':`±${Math.round(p.gps.accuracy)} m`}`:'Balise inactive'}</span><button className="button button-small button-soft" onClick={()=>{if(sharing)void p.gps.stop();else setConsent(true);}}>{sharing?'Arrêter':'Activer le GPS'}</button></div>}
 {p.match.state==='briefing'&&<MatchBriefing match={p.match} me={p.me} host={p.host} disabled={disabled} onAction={(action,options)=>void p.onAction(action,options)}/>}
 {ended&&<MatchResult match={p.match} members={p.members} host={p.host} busy={disabled} onPrepare={target=>void p.onAction('create',{target})}/>}
 {playing&&<>
 <div className="match-map"><MapView locations={p.match.locations} me={p.me} recenterSignal={recenter} focusedPlayerId={null} onSelectPlayer={()=>{}} zone={{latitude:p.match.terrain.latitude,longitude:p.match.terrain.longitude,radiusMeters:p.match.terrain.radius_m}} clue={p.match.clue} extraction={{latitude:p.match.terrain.extractionLatitude,longitude:p.match.terrain.extractionLongitude,radiusMeters:50}}/></div>
 <section className="match-clock" aria-label="Temps de manche"><span className={`role-chip ${p.match.role}`}>{p.match.role==='target'?'CIBLE':'CHASSEUR'}</span><strong aria-label={`${Math.floor(remaining/60)} minutes ${remaining%60} secondes restantes`}>{clock}</strong><span>{p.match.state==='paused'?'EN PAUSE':displayElapsed<30?`AVANCE · ${Math.ceil(30-displayElapsed)} s`:'LA PISTE'}</span></section>
 <button className="match-recenter icon-button" aria-label="Centrer sur ma position" onClick={()=>setRecenter(v=>v+1)}><Crosshair size={24}/></button>
 <section className="match-command"><p className="eyebrow">{p.match.state==='paused'?'SIGNAL EN ATTENTE':p.match.role==='target'?'TON OBJECTIF':'DERNIER INDICE'}</p>
 <h1>{p.match.state==='paused'?'Pause. On se retrouve.':p.match.role==='target'?displayElapsed<600?'Garde une longueur d’avance.':'L’extraction est ouverte.':p.match.clue?'Cherche dans la zone.':'La piste arrive.'}</h1>
 <p>{p.match.state==='paused'?p.match.pauseReason:p.match.role==='target'?displayElapsed<600?'Les chasseurs voient une zone approximative. Extraction au centre du terrain après 10 minutes.':'Rejoins le cercle de 50 m. Reste à l’arrêt, GPS précis, au moins cinq secondes.':p.match.clue?`Indice ${p.match.clue.ageBucket==='old'?'ancien':'récent'} · maille de 200 m, élargie si le signal est incertain.`:'Premier indice après l’avance, puis toutes les 90 secondes.'}</p>
 {p.match.state==='running'&&p.match.role==='target'&&p.match.capture&&<div className="capture-request"><strong>Un chasseur dit t’avoir rejoint.</strong><p>Confirme uniquement si vous vous êtes rencontrés.</p><button className="button button-primary button-wide" disabled={disabled} onClick={()=>void p.onAction('confirm',{request:p.match.capture!.id})}>Confirmer la rencontre</button></div>}
 <div className="match-command-actions">{p.match.state==='running'&&<button className="button button-primary" disabled={disabled||displayElapsed<30||(p.match.role==='target'&&displayElapsed<600)} onClick={()=>setConfirm(p.match.role==='target'?'extract':'capture')}>{p.match.role==='target'?<><Flag size={18}/>Demander l’extraction</>:<><Crosshair size={18}/>Cible rencontrée</>}</button>}
 {p.host&&<button className="button button-soft" disabled={disabled} onClick={()=>void p.onAction(p.match.state==='paused'?'resume':'pause')}>{p.match.state==='paused'?<Play size={18}/>:<Pause size={18}/>}<span>{p.match.state==='paused'?'Reprendre':'Pause'}</span></button>}</div>
 </section></>}
 {p.host&&!ended&&<button className="match-cancel button button-ghost" disabled={disabled} onClick={()=>setConfirm('cancel')}>Annuler la manche</button>}
 {consent&&<Dialog title="Activer ta balise ?" onClose={()=>setConsent(false)}><p>{p.match.role==='target'?'Ta position exacte reste visible uniquement par toi. Les chasseurs reçoivent des indices approximatifs.':'Ta position est visible par les autres chasseurs. La cible ne voit que sa propre position.'}</p><p>Garde HUNT ouverte. Le navigateur peut suspendre le GPS en arrière-plan. Tu peux arrêter à tout moment.</p><button className="button button-primary button-wide" onClick={()=>{setConsent(false);void p.gps.start();}}><ShieldCheck size={18}/>Continuer vers l’autorisation</button></Dialog>}
 {confirm&&<Dialog title={confirm==='capture'?'Tu as rencontré la cible ?':confirm==='extract'?'Prêt pour l’extraction ?':confirm==='cancel'?'Annuler cette manche ?':'Quitter la manche ?'} onClose={()=>setConfirm(null)}><p>{confirm==='capture'?'La cible devra confirmer la rencontre sous 30 secondes.':confirm==='extract'?'Le serveur vérifie deux mesures GPS précises dans le cercle.':confirm==='cancel'?'La manche s’arrête et les positions sont effacées.':'Ton départ arrête cette manche pour l’équipe. Ta balise sera coupée.'}</p><button className="button button-primary button-wide" disabled={disabled&&confirm!=='exit'} onClick={()=>{const action=confirm;setConfirm(null);if(action==='exit')p.onExit();else void p.onAction(action);}}>Confirmer</button><button className="button button-ghost button-wide" onClick={()=>setConfirm(null)}>Revenir au jeu</button></Dialog>}
 </main>;
}
