'use client';
import { Download, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { canInstallPwa, getInstallHelp, isStandaloneMode } from '../lib/pwa-install';
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{outcome:string}> };
export default function InstallPrompt() {
 const [event,setEvent]=useState<InstallEvent|null>(null);
 const [device,setDevice]=useState({userAgent:'',maxTouchPoints:0,standalone:true});
 const [error,setError]=useState('');
 useEffect(()=>{
  const refresh=()=>setDevice({userAgent:navigator.userAgent,maxTouchPoints:navigator.maxTouchPoints,standalone:isStandaloneMode(window.matchMedia('(display-mode: standalone)').matches?'standalone':'browser',Boolean((navigator as Navigator&{standalone?:boolean}).standalone))});
  refresh();
  const offered=(e:Event)=>{if(canInstallPwa(e)){e.preventDefault();setEvent(e as InstallEvent);}};
  const installed=()=>{setEvent(null);setDevice(d=>({...d,standalone:true}));};
  window.addEventListener('beforeinstallprompt',offered);window.addEventListener('appinstalled',installed);
  const mode=window.matchMedia('(display-mode: standalone)');mode.addEventListener('change',refresh);
  return()=>{window.removeEventListener('beforeinstallprompt',offered);window.removeEventListener('appinstalled',installed);mode.removeEventListener('change',refresh);};
 },[]);
 const help=getInstallHelp({...device,hasPrompt:!!event});
 if(help.kind==='installed')return null;
 async function install(){if(!event)return;setError('');try{await event.prompt();await event.userChoice;setEvent(null);}catch{setError('Installation indisponible. Utilise le menu de ton navigateur.');setEvent(null);}}
 return <details className="install-help"><summary><Download size={16}/><span>Installer HUNT</span><ChevronDown size={16}/></summary><div><p>{help.text}</p>{event&&<button className="button button-soft" onClick={()=>void install()}>Installer</button>}{error&&<p role="status">{error}</p>}<small>Aucune boutique, aucun téléchargement de compte.</small></div></details>;
}
