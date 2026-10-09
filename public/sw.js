/* Public application shell only. Never cache GPS, identity or API responses. */
const CACHE = 'hunt-shell-' + (new URL(self.location.href).searchParams.get('v') || 'v1');
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];
self.addEventListener('install', event => event.waitUntil((async () => {
 const cache=await caches.open(CACHE);await cache.addAll(SHELL);
 const html=await (await cache.match('/')).text();
 const assets=[...html.matchAll(/(?:src|href)="([^"\s]+)"/g)].map(m=>new URL(m[1],self.location.origin)).filter(url=>url.origin===self.location.origin&&url.pathname.startsWith('/_next/static/')&&/\.(js|css|woff2)$/.test(url.pathname));
 await cache.addAll([...new Set(assets.map(url=>url.href))]);
})()));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('hunt-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
const updateChecks=new Map();
self.addEventListener('message', event => {
 if(event.data?.type==='HUNT_UPDATE_STATUS') { const resolve=updateChecks.get(event.source?.id+':'+event.data.nonce);if(resolve)resolve(event.data.allow===true);return; }
 if(event.data?.type!=='APPLY_UPDATE')return;
 event.waitUntil((async()=>{
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});const nonce=crypto.randomUUID();
  const allowed=await Promise.all(clients.map(client=>new Promise(resolve=>{
   const key=client.id+':'+nonce;const timer=setTimeout(()=>{updateChecks.delete(key);resolve(false);},2000);
   updateChecks.set(key,value=>{clearTimeout(timer);updateChecks.delete(key);resolve(value);});client.postMessage({type:'HUNT_UPDATE_CHECK',nonce});
  })));
  const safe=allowed.every(Boolean);event.ports[0]?.postMessage({allowed:safe});if(safe)await self.skipWaiting();
 })());
});
self.addEventListener('fetch', event => {
 const request = event.request;
 const url = new URL(request.url);
 if (request.method !== 'GET' || url.origin !== self.location.origin) return;
 if (url.pathname === '/release.json' || url.pathname.startsWith('/api/') || url.pathname.includes('/rest/') || url.pathname.includes('/auth/')) return;
 if (request.mode === 'navigate') {
  event.respondWith(fetch(request).catch(async () => (await caches.match('/')) || new Response('HUNT est hors ligne. Reconnecte-toi pour rejoindre ton équipe.', {status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}})));
  return;
 }
 // Immutable production chunks and public assets; no development hot reload data.
 if (SHELL.includes(url.pathname) || /^\/_next\/static\/.*[a-f0-9]{8,}.*\.(js|css|woff2)$/.test(url.pathname)) {
  event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => {
   if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(request,copy))); }
   return response;
  })));
 }
});
