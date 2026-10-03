// Study Paws service worker · V0.5.0
const VERSION='v0.5.0';
const CACHE=`study-paws-${VERSION}`;
const ASSETS=[
  './','./index.html','./manifest.webmanifest',
  './css/app.css?v=0.5.0','./js/app.js?v=0.5.0',
  './js/ui.js','./js/storage.js','./js/subjects.js','./js/files.js',
  './js/extract.js','./js/guides.js','./js/brain.js','./js/source-policy.js',
  './js/knowledge-state.js','./js/context-planner.js','./js/prompt-builder.js',
  './js/study-retrieval.js','./js/smart-class.js','./js/context-inspector.js',
  './assets/icons/icon.svg','./assets/icons/icon-maskable.svg'
];

self.addEventListener('install',(e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',(e)=>{
  e.waitUntil(caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k.startsWith('study-paws-')&&k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});
self.addEventListener('fetch',(e)=>{
  const req=e.request;
  if(req.method!=='GET'||new URL(req.url).origin!==location.origin) return;
  const url=new URL(req.url);
  const isAppCode=req.mode==='navigate'||/\.(?:js|css|html|webmanifest)$/.test(url.pathname);
  if(isAppCode){
    e.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      try{
        const res=await fetch(req,{cache:'no-store'});
        if(res.ok) cache.put(req,res.clone());
        return res;
      }catch{
        return (await cache.match(req))||(req.mode==='navigate'?cache.match('./index.html'):new Response('Sin conexión',{status:503}));
      }
    })());
    return;
  }
  e.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{
    if(res.ok) caches.open(CACHE).then(c=>c.put(req,res.clone()));
    return res;
  })));
});
