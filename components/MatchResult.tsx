'use client';
import { Flag, RotateCcw } from 'lucide-react';
import type { Member } from '../lib/types';
import type { MatchSnapshot } from '../lib/match';
import MatchPreparation from './MatchPreparation';
export default function MatchResult({match,members,host,busy,onPrepare}:{match:MatchSnapshot;members:Member[];host:boolean;busy:boolean;onPrepare:(target:string)=>void}) {
 const result=match.result;
 const reason=result?.reason==='extraction'?'Extraction réussie':result?.reason==='interception'?'Rencontre confirmée':'Temps écoulé';
 return <section className="result-screen"><span className="result-mark"><Flag size={36}/></span><p className="eyebrow">LA PISTE · {result?'RÉSULTAT':'MANCHE ARRÊTÉE'}</p><h1>{!result?'On se retrouve.':result.winner==='target'?'La cible s’échappe.':'L’équipe l’emporte.'}</h1><p className="match-lead">{result?reason:match.pauseReason??'La manche a été annulée.'}</p>{result&&<p className="result-duration">{Math.floor(result.duration/60)}<small>min</small> {Math.floor(result.duration%60).toString().padStart(2,'0')}<small>s</small></p>}<p className="rules-footnote">Partage arrêté. Positions de la manche effacées.</p><div className="rematch-heading"><RotateCcw size={18}/><span>Une autre manche ? Changez de cible.</span></div><MatchPreparation members={members} host={host} terrainReady busy={busy} available onPrepare={onPrepare}/></section>;
}
