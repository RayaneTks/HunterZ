'use client';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
export default function Dialog({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}) {
 const ref=useRef<HTMLDialogElement>(null);const close=useRef(onClose);close.current=onClose;
 useEffect(()=>{const before=document.activeElement as HTMLElement;const element=ref.current;element?.showModal();return()=>{element?.close();before?.focus();};},[]);
 return <dialog ref={ref} className="hunt-dialog" aria-label={title} onCancel={e=>{e.preventDefault();close.current();}} onClick={e=>{if(e.target===e.currentTarget)close.current();}}><div className="rules-heading"><h2>{title}</h2><button className="icon-button" aria-label="Fermer" onClick={onClose}><X size={20}/></button></div>{children}</dialog>;
}
