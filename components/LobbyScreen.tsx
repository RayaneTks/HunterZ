'use client';
import type { ReactNode } from 'react';
export default function LobbyScreen({map,tools,sheet,dialogs}:{map:ReactNode;tools:ReactNode;sheet:ReactNode;dialogs:ReactNode}) {
 return <section className="lobby-view" aria-label="Lobby de la chasse"><div className="field-map-shell">{map}{tools}</div>{sheet}{dialogs}</section>;
}
