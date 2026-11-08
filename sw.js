// Necessário para o celular oferecer "Instalar app". Não guarda cache:
// o app sempre carrega a versão publicada mais recente.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
