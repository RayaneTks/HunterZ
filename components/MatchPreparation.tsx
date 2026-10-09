'use client';
import { ArrowRight, Crosshair, Users } from 'lucide-react';
import { useState } from 'react';
import type { Member } from '../lib/types';
export default function MatchPreparation({members,host,terrainReady,busy,available,onPrepare}:{members:Member[];host:boolean;terrainReady:boolean;busy:boolean;available:boolean;onPrepare:(target:string)=>void}) {
 const [target,setTarget]=useState('');const validTarget=members.some(m=>m.user_id===target)?target:'';
 return <section className="match-preparation"><div className="lobby-section-heading"><div><p className="lobby-kicker">MODE DE JEU</p><h3>La Piste</h3></div><Crosshair size={24}/></div><p>Une cible volontaire. Des indices. 15 minutes pour jouer la rencontre.</p><div className="match-meta"><span><Users size={16}/>{members.length} / 4–10 joueurs</span><span>15 min</span></div>
 {host?<><label htmlFor="match-target" className="field-label">Qui veut jouer la cible ?</label><select id="match-target" value={validTarget} onChange={e=>setTarget(e.target.value)} disabled={busy}><option value="">Choisir avec l’équipe</option>{members.map(m=><option key={m.user_id} value={m.user_id}>{m.profiles?.nickname??'Joueur'}</option>)}</select>
 <p className="match-extraction-choice">Extraction choisie : centre du terrain, cercle de 50 m. Vérifiez ensemble qu’il est accessible.</p>
 <button className="button button-primary button-wide" disabled={busy||!available||!validTarget||!terrainReady||members.length<4||members.length>10} onClick={()=>onPrepare(validTarget)}>Préparer la manche<ArrowRight size={18}/></button>
 {!available&&<p className="muted">La Piste est indisponible pour le moment.</p>}
 {members.length<4&&<p className="muted">Encore {4-members.length} joueur{4-members.length>1?'s':''} pour lancer une manche.</p>}
 </>:<p className="muted">L’hôte prépare la manche. La cible doit confirmer son rôle avant le départ.</p>}</section>;
}
