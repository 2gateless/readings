const CACHE = 'reading-v12';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './b_1.png',
  './b_2.png',
  './favicon.png',
  './icon-192.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Firebase 실시간/인증 API 및 OAuth 요청은 캐시하지 않음 (단, gstatic Firebase SDK 정적 파일과 표지 이미지는 캐시 허용)
  const isNetworkOnly =
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('accounts.google.com') ||
    (url.hostname.includes('googleapis.com') && !url.hostname.includes('firebasestorage.googleapis.com'));

  if (isNetworkOnly) {
    return;
  }

  // index.html / 네비게이션: 네트워크 우선 + 성공 시 캐시 갱신 (오프라인 시 캐시 폴백)
  if (e.request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // 버전 고정 CDN(Firebase SDK, Marked, DOMPurify, KaTeX) 및 정적 자산/표지 이미지: 캐시 우선
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
