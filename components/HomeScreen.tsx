'use client';
import { ArrowRight, Crosshair, MapPin, Radio, ShieldCheck, Users, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type Props = {
 nickname: string; nicknameInput: string; invite: string; joinCode: string; busy: boolean;
 error: string; errorScope: string;
 onNickname: (value: string) => void; onCode: (value: string) => void;
 onLogin: () => void; onCreate: () => void; onJoin: () => void;
};
function Radar() {
 return <div className="hunt-radar" aria-hidden="true"><svg viewBox="0 0 320 220" fill="none">
 <path d="M0 56H320M0 112H320M0 168H320M48 0V220M104 0V220M160 0V220M216 0V220M272 0V220" stroke="currentColor" opacity=".13"/>
 <path d="M0 195L108 89H222L320 0M38 0V62L191 220M0 28L320 163" stroke="currentColor" opacity=".2" strokeWidth="8"/>
 <circle cx="160" cy="112" r="84" stroke="currentColor" opacity=".22"/><circle cx="160" cy="112" r="52" stroke="currentColor" opacity=".4"/>
 <path d="M160 112L206 54" stroke="#f05a50" strokeWidth="2"/><path d="M145 87H135V97M175 87H185V97M135 127V137H145M185 127V137H175" stroke="#f3efe6" strokeWidth="3"/>
 <circle cx="160" cy="112" r="6" fill="#f05a50"/><circle cx="112" cy="149" r="4" fill="#a4c5a8"/><circle cx="231" cy="79" r="4" fill="#a4c5a8"/>
 </svg><span className="radar-caption">SORTIR DU QUOTIDIEN</span></div>;
}
export default function HomeScreen(p: Props) {
 const [rules, setRules] = useState(false);
 const rulesTrigger = useRef<HTMLButtonElement>(null);
 const dialog = useRef<HTMLElement>(null);
 useEffect(()=>{
  if(!rules) return;
  const previous=document.activeElement as HTMLElement;
  dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
  const onKey=(event: KeyboardEvent)=>{
   if(event.key==='Escape') setRules(false);
   if(event.key==='Tab') {
    const controls=dialog.current?.querySelectorAll<HTMLElement>('button,a,input');
    if(!controls?.length) return;
    const first=controls[0],last=controls[controls.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
   }
  };
  document.addEventListener('keydown',onKey);
  return ()=>{document.removeEventListener('keydown',onKey);previous?.focus();};
 },[rules]);
 const inlineError=(scope:string)=>p.error&&p.errorScope===scope?<p className="action-error" role="alert">{p.error}</p>:null;
 return <>
 <section className={`home-screen ${p.nickname?'home-ready':''}`}>
  <div className="home-story"><p className="eyebrow"><span className="rec-dot"/> LE TERRAIN, C’EST TA VILLE</p>
   <h1>{p.nickname?<>Monte ton<br/>escouade.</>:<>Dehors.<br/>Ensemble.</>}</h1>
   <p className="home-description">{p.nickname?`À toi de jouer, ${p.nickname}. Réunis ton équipe dans un salon privé.`:'Une ville. Ton équipe. Une chasse à vivre pour de vrai.'}</p>
   <Radar/>
   <div className="home-facts"><span><Users size={16}/> Entre amis</span><span><MapPin size={16}/> En plein air</span></div>
  </div>
  <div className="home-actions">
   {!p.nickname?<form className="entry-card" onSubmit={e=>{e.preventDefault();p.onLogin();}} aria-busy={p.busy}>
    <div className="entry-heading"><span className="step-index">01</span><div><h2>Choisis ton indicatif</h2><p>Pas de compte à créer.</p></div></div>
    {p.invite&&<p className="invite-context">Ton équipe t’attend dans <strong>{p.invite}</strong>.</p>}
    <label htmlFor="nickname" className="field-label">Ton pseudo</label>
    <input id="nickname" value={p.nicknameInput} onChange={e=>p.onNickname(e.target.value)} placeholder="Comment on t’appelle ?" minLength={2} maxLength={24} required autoComplete="nickname" enterKeyHint="go"/>
    {inlineError('profile')}
    <button type="submit" className="button button-primary button-wide" disabled={p.busy}>{p.busy?'Connexion…':<>Entrer dans HUNT<ArrowRight size={20}/></>}</button>
   </form>:<div className="command-actions">
    <div className="entry-heading"><Crosshair size={24}/><div><h2>Prochaine sortie</h2><p>Tout commence dans ton salon.</p></div></div>
    <button className="button button-primary button-wide" disabled={p.busy} onClick={p.onCreate}>Créer un salon<ArrowRight size={20}/></button>
    {inlineError('create')}
    <form className="join-action" onSubmit={e=>{e.preventDefault();p.onJoin();}}>
     <label htmlFor="join-code" className="join-label">Rejoindre avec un code</label>
     <div className="join-row"><input id="join-code" value={p.joinCode} onChange={e=>p.onCode(e.target.value.replace(/[^a-z0-9]/gi,'').toUpperCase())} placeholder="6 CARACTÈRES" maxLength={6} minLength={6} required autoComplete="off" autoCapitalize="characters" spellCheck={false}/><button className="button button-soft" disabled={p.busy||p.joinCode.length!==6} aria-label="Rejoindre la chasse"><ArrowRight size={20}/></button></div>
     {inlineError('join')}
    </form>
   </div>}
   <p className="privacy-note"><ShieldCheck size={16}/>Le GPS démarre avec ton accord, dans ton salon.</p>
   <button ref={rulesTrigger} className="rules-trigger button button-ghost" onClick={()=>setRules(true)}><Radio size={16}/>Comment jouer<ArrowRight size={16}/></button>
  </div>
 </section>
 {rules&&<div className="gps-consent-backdrop" onClick={e=>{if(e.target===e.currentTarget)setRules(false);}}><section ref={dialog} className="rules-dialog" role="dialog" aria-modal="true" aria-labelledby="rules-title">
 <div className="rules-heading"><p className="eyebrow">LE JEU HUNT</p><button className="icon-button" aria-label="Fermer les règles" onClick={()=>setRules(false)}><X size={20}/></button></div>
 <h2 id="rules-title">La Piste</h2><p>Une cible, une équipe de chasseurs, quinze minutes.</p>
 <ol className="rules-steps"><li><strong>Réunis 4 à 10 joueurs</strong><span>Choisissez votre terrain et une cible volontaire.</span></li><li><strong>Lis les indices</strong><span>Les chasseurs reçoivent une zone approximative. La position exacte de la cible reste privée.</span></li><li><strong>Joue la rencontre</strong><span>La cible confirme une interception. Après dix minutes, elle peut rejoindre l’extraction.</span></li></ol>
 <p className="rules-footnote">Restez sur des chemins accessibles. Gardez HUNT ouverte : le navigateur peut suspendre le GPS en arrière-plan.</p>
 <button className="button button-primary button-wide" onClick={()=>setRules(false)}>C’est parti<ArrowRight size={18}/></button>
 </section></div>}
 </>;
}
