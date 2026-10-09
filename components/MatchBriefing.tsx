'use client';
import { ArrowRight, Check, Crosshair, Radio } from 'lucide-react';
import type { MatchSnapshot } from '../lib/match';
export default function MatchBriefing({match,me,host,disabled,onAction}:{match:MatchSnapshot;me:string;host:boolean;disabled:boolean;onAction:(action:string,options?:{ready?:boolean})=>void}) {
 const own=match.roster.find(p=>p.user_id===me);const ready=match.roster.every(p=>p.ready&&p.gpsReady);
 return <section className="briefing-screen"><p className="eyebrow"><span className="rec-dot"/> BRIEFING · LA PISTE</p><h1>{match.role==='target'?'Tu es la cible.':'Tu es chasseur.'}</h1><p className="match-lead">{match.role==='target'?'30 secondes d’avance. Tes coordonnées exactes restent privées. Les chasseurs recevront des zones approximatives.':'Cherche en équipe. Un indice approximatif toutes les 90 secondes après l’avance de la cible.'}</p>
 <div className="briefing-rules"><div><Crosshair size={20}/><span><strong>15 minutes</strong><small>Une rencontre confirmée par la cible pour intercepter.</small></span></div><div><Radio size={20}/><span><strong>Extraction après 10 minutes</strong><small>Centre du terrain, cercle de 50 m. Deux mesures précises, à 5 secondes d’intervalle.</small></span></div></div>
 <p className="rules-footnote">Valider confirme ton rôle, le terrain et l’extraction. Vous pouvez annuler avant le départ. Restez sur des chemins accessibles.</p>
 <ul className="briefing-roster">{match.roster.map(p=><li key={p.user_id}><span className={`member-avatar ${p.user_id===me?'self':''}`}>{p.nickname.slice(0,1)}</span><span><strong>{p.nickname}{p.user_id===me?' · toi':''}</strong><small>{p.role==='target'?'Cible':'Chasseur'} · {p.gpsReady?'GPS prêt':'GPS à activer'}</small></span><span className={p.ready?'ready-check':''}>{p.ready?<Check size={20}/>:<span className="waiting-dot"/>}</span></li>)}</ul>
 <button className="button button-primary button-wide" disabled={disabled||!own?.gpsReady} onClick={()=>onAction('ready',{ready:!own?.ready})}>{own?.ready?'Retirer ma confirmation':match.role==='target'?'J’accepte de jouer la cible':'Je suis prêt'}<Check size={18}/></button>
 {!own?.gpsReady&&<p className="muted">Active ta balise. Le départ exige un GPS récent et précis (±30 m).</p>}
 {host&&<button className="button button-soft button-wide" disabled={disabled||!ready} onClick={()=>onAction('start')}>Lancer la manche<ArrowRight size={18}/></button>}
 </section>;
}
