import type { Metadata, Viewport } from 'next';
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';
import ReleaseNotes from '../components/ReleaseNotes';
import PwaLifecycle from '../components/PwaLifecycle';
export const metadata: Metadata = { title: 'HUNT — Le terrain, c’est ta ville', description: 'Une chasse GPS privée en temps réel.', manifest: '/manifest.webmanifest', appleWebApp: { capable: true, title: 'HUNT', statusBarStyle: 'black-translucent' }, icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#111416' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="fr"><body>{children}<PwaLifecycle /><ReleaseNotes /></body></html>; }

