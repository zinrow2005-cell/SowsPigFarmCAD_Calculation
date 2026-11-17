'use strict';
const PREFIX='huwei-cad-pwa-';const CACHE=PREFIX+'1.7.4';const FILES=["./", "./index.html", "./manifest.webmanifest", "./assets/app.css", "./assets/app.js", "./assets/cad-labels.js", "./assets/cad-model.js", "./assets/cad-source.js", "./assets/calibration.js", "./assets/dxf-export.js", "./assets/land-audit-data.js", "./assets/layout1230.js", "./assets/parcels.js", "./assets/pwa.js", "./assets/share.css", "./assets/share.js", "./assets/simple-ui.css", "./assets/simple-ui.js", "./assets/smart-labels.js", "./icons/icon-180.png", "./icons/icon-192.png", "./icons/icon-32.png", "./icons/icon-512.png", "./icons/maskable-512.png"];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const req=event.request;if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin||!req.url.startsWith(self.registration.scope))return;
if(req.mode==='navigate'){event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match('./index.html'))||fetch(req)));return;}
event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(req))||fetch(req)));});
