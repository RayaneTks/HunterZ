export default function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`brand-lockup ${compact ? "brand-compact" : ""}`} aria-label="HUNT"><svg className="brand-mark" viewBox="0 0 48 48" aria-hidden="true"><path fill="currentColor" d="M5 5h13v5h-8v8H5zm25 0h13v13h-5v-8h-8zM5 30h5v8h8v5H5zm33 0h5v13H30v-5h8z" /><circle cx="24" cy="24" r="5" fill="#f05a50" /></svg><svg className="brand-name" viewBox="0 0 136 24" aria-hidden="true"><path fill="currentColor" d="M0 0h7v9h14V0h7v24h-7v-9H7v9H0zM36 0h7v17h14V0h7v19q0 5-5 5H41q-5 0-5-5zM73 0h7l15 15V0h7v24h-7L80 9v15h-7zM110 0h26v7h-9v17h-8V7h-9z" /></svg></div>;
}

