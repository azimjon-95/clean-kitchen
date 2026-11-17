# Clean Kitchen — Client (oshpaz ilovasi)

Restoran texnologik kartalari uchun oshpazga mo'ljallangan front-end (React + Vite + TypeScript).
`clean-kitchen v12` monoreposidagi `apps/client` dan ajratib olingan, mustaqil ishlaydi.

## Ishga tushirish

```bash
npm install
cp .env.example .env     # kerak bo'lsa VITE_API_URL ni o'zgartiring
npm run dev              # http://localhost:5173
```

Faqat demo ma'lumot bilan (serverga umuman so'rov yubormasdan):

```bash
npm run dev:mock
```

Production build: `npm run build` → `dist/`.

## Ma'lumot manbasi (server → kesh → mock)

`src/lib/api.ts` quyidagi tartibda ishlaydi:

| Holat | Nima ko'rsatiladi | Belgi |
|-------|-------------------|-------|
| Server javob berdi | Server kartalari (IndexedDB ga keshlanadi) | 🟢 «Онлайн · данные сервера» |
| Server javob bermadi (5 s timeout / xato), kesh bor | IndexedDB keshi | 🔵 «Офлайн · локальный кэш» |
| Server javob bermadi va kesh bo'sh, yoki server bo'sh ro'yxat qaytardi | **30 ta mock karta** | 🟠 «Демо-режим · 30 тестовых карт» |
| `VITE_USE_MOCK=true` | 30 ta mock karta | 🟠 |

Demo rejimida «Подключиться к серверу» tugmasi serverga qayta ulanishga urinadi.

## Mock data

`src/data/mockRecipes.ts` — 30 ta texnologik karta, barcha 4 sex va uchastkalar bo'yicha:

- **Горячий цех** (14): Соусы, Паста, Мангал, Раздача, Заготовка — болоньезе, карбонара, шашлык, плов ташкентский…
- **Суши** (6): Роллы, Сашими / Нигири, Заготовка
- **Холодный цех** (6): Салаты, Закуски, Заготовка — цезарь, ачичук…
- **Кондитерский** (4): Десерты, Пекарный, Заготовка — тирамису, круассан…

Har bir kartada: ingredientlar (miqdor + birlik → porsiya bo'yicha masshtablash ishlaydi),
texnologiya bosqichlari, food cost (UZS) va qidiruv uchun RU/UZ teglar.
Format server API (`GET /api/recipes`) javobiga mos.

## Tuzilma

```
src/
  App.tsx               — asosiy UI
  types.ts              — Recipe va boshqa turlar
  data/mockRecipes.ts   — 30 ta demo karta
  lib/api.ts            — server/kesh/mock yuklash
  lib/offline.ts        — IndexedDB kesh va sevimlilar
  lib/speech.ts         — ovozli qidiruv (Web Speech / Capacitor)
  lib/voiceCorrect.ts   — RU/UZ ovozli so'rovni tuzatish
public/sw.js            — offline shell uchun Service Worker
```

## Muhit o'zgaruvchilari

| O'zgaruvchi | Standart | Tavsif |
|-------------|----------|--------|
| `VITE_API_URL` | `http://localhost:4000` | Backend manzili |
| `VITE_USE_MOCK` | `false` | `true` — faqat mock data |

## Native (Capacitor)

`capacitor.config.ts` ichidagi izohlarga qarang.
