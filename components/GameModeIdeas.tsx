'use client';

import { Compass, Crosshair, Flag, Footprints, PackageOpen } from 'lucide-react';
import { useState } from 'react';

const concepts = [
  {
    id: 'the-trail', title: 'La Piste', kind: 'Traque en équipe', icon: Crosshair,
    summary: 'Des indices rapprochent les chasseurs d’une cible qui cherche une issue.',
    detail: 'Le groupe suit une piste de plus en plus précise. La cible garde des choix d’itinéraire; une interception pourrait ouvrir un duel numérique dans l’app. Règles et capture encore à concevoir.',
  },
  {
    id: 'secret-targets', title: 'Cibles secrètes', kind: 'Mêlée générale', icon: Compass,
    summary: 'Chacun traque une personne tout en essayant d’échapper à son propre poursuivant.',
    detail: 'Une carte pleine de trajectoires croisées : chaque joueur est à la fois chasseur et proie. Une capture ne devrait éliminer personne; la redistribution des cibles reste à trouver.',
  },
  {
    id: 'field-loot', title: 'Butin de terrain', kind: 'Exploration & capacités', icon: PackageOpen,
    summary: 'Explore la zone pour trouver des caches virtuelles et préparer des capacités.',
    detail: 'Inspiré des jeux d’exploration sur carte : les escouades visitent des points accessibles, récupèrent des ressources fictives, puis les utilisent dans des défis entre joueurs. Les déplacements et les affrontements sont encore des idées, sans règle définie.',
  },
  {
    id: 'beacons', title: 'Balises', kind: 'Contrôle de zone', icon: Flag,
    summary: 'Deux équipes se coordonnent pour atteindre et tenir des points du terrain.',
    detail: 'Les équipes choisissent quand se regrouper, défendre une balise ou tenter un détour. Le score, les rôles et les règles de contrôle sont à imaginer.',
  },
  {
    id: 'scouts', title: 'Éclaireurs', kind: 'Progression collective', icon: Footprints,
    summary: 'L’escouade découvre le terrain et suit une suite d’objectifs communs.',
    detail: 'Une option plus coopérative : les joueurs explorent ensemble des étapes réparties dans la zone. Cette piste doit encore trouver son suspense et sa rejouabilité.',
  },
];

export default function GameModeIdeas() {
  const [selectedId, setSelectedId] = useState(concepts[0].id);
  const selected = concepts.find((concept) => concept.id === selectedId) ?? concepts[0];

  return (
    <section className="mode-ideas" aria-labelledby="mode-ideas-title">
      <div className="lobby-section-heading">
        <div><p className="lobby-kicker">CARNET D’IDÉES</p><h3 id="mode-ideas-title">Quel genre de chasse ?</h3></div>
        <span className="concept-badge">À EXPLORER</span>
      </div>
      <p className="mode-ideas-intro">Ces modes sont en réflexion et ne sont pas encore jouables. Choisis une piste pour lire son idée : rien ne démarre et ce choix n’est pas enregistré.</p>
      <div className="mode-idea-options" role="group" aria-label="Idées de modes de jeu">
        {concepts.map(({ id, title, kind, icon: Icon }) => (
          <button key={id} type="button" className={`mode-idea-option ${selectedId === id ? 'selected' : ''}`} aria-pressed={selectedId === id} onClick={() => setSelectedId(id)}>
            <Icon size={17} aria-hidden="true" />
            <span><strong>{title}</strong><small>{kind}</small></span>
            {selectedId === id && <span className="mode-selected-mark" aria-hidden="true">●</span>}
          </button>
        ))}
      </div>
      <article className="mode-idea-detail" aria-live="polite" aria-atomic="true">
        <p className="concept-badge">CONCEPT · {selected.kind.toUpperCase()}</p>
        <h4>{selected.title}</h4>
        <p className="mode-idea-summary">{selected.summary}</p>
        <p className="mode-idea-copy">{selected.detail}</p>
      </article>
    </section>
  );
}
