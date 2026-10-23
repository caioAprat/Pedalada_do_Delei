// Pedalada do Delei - Service Worker
// IMPORTANTE: sempre que publicar uma versão nova do app, aumente o número abaixo
// (e o VERSAO dentro do index.html). É isso que faz aparecer o aviso "Nova versão disponível".
const VERSAO = '6.0.1';
const CACHE = 'pedalada-app-' + VERSAO;
const CACHE_FONTES = 'pedalada-fontes';
const ARQUIVOS = ['./', './index.html', './manifest.json', './icon.svg'];
const FONTE_CSS = 'https://fonts.googleapis.com/css2?family=Saira:wght@100;200;300;400;500;600;700&family=Michroma&family=JetBrains+Mono:wght@100;200;300;400;500;600&display=swap';

// Instalação: guarda os arquivos do app. A fonte é opcional (se estiver sem internet, não trava).
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(ARQUIVOS);
    try { const f = await caches.open(CACHE_FONTES); await f.add(FONTE_CSS); } catch (e) {}
  })());
  // Não ativa sozinho: espera você clicar em "Atualizar" no aviso do app.
});

// O app manda esta mensagem quando você clica em "Atualizar".
self.addEventListener('message', event => {
  if (event.data === 'ATUALIZAR_AGORA') self.skipWaiting();
});

// Ativação: apaga caches de versões antigas (mantém as fontes).
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n !== CACHE && n !== CACHE_FONTES).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fontes do Google: usa a cópia guardada e atualiza em segundo plano (funciona sem internet).
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith((async () => {
      const c = await caches.open(CACHE_FONTES);
      const guardada = await c.match(req);
      const daRede = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => null);
      return guardada || (await daRede) || new Response('', { status: 504 });
    })());
    return;
  }

  // Arquivos do próprio app: tenta a internet primeiro (versão mais nova); sem internet, usa a cópia.
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const r = await fetch(req);
        if (r && r.ok) c.put(req, r.clone());
        return r;
      } catch (e) {
        return (await c.match(req, { ignoreSearch: true })) ||
               (req.mode === 'navigate' ? await c.match('./index.html') : undefined) ||
               new Response('Sem conexão', { status: 503 });
      }
    })());
  }
});
