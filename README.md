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
| Server javob bermadi va kesh bo'sh, yoki server bo'sh ro'yxat qaytardi | **37 ta mock karta** | 🟠 «Демо-режим · 37 тестовых карт» |
| `VITE_USE_MOCK=true` | 37 ta mock karta | 🟠 |

Demo rejimida «Подключиться к серверу» tugmasi serverga qayta ulanishga urinadi.

## Mock data

`src/data/mockRecipes.ts` — 37 ta texnologik karta, barcha 4 sex va uchastkalar bo'yicha:

- **Горячий цех** (19): Соусы, Паста, Мангал, Раздача, Заготовка — болоньезе, карбонара, шашлык, плов ташкентский…
- **Суши** (6): Роллы, Сашими / Нигири, Заготовка
- **Холодный цех** (6): Салаты, Закуски, Заготовка — цезарь, ачичук…
- **Кондитерский** (6): Десерты, Пекарный, Заготовка — тирамису, круассан…

Har bir kartada: ingredientlar (miqdor + birlik → porsiya bo'yicha masshtablash ishlaydi),
texnologiya bosqichlari, food cost (UZS) va qidiruv uchun RU/UZ teglar.
Format server API (`GET /api/recipes`) javobiga mos.

## Интерфейс (iPhone / iPad)

Весь интерфейс на русском языке. Главная: шапка с уведомлениями, баннер-карусель, поиск (по названию и ингредиентам)
с кнопками голосового поиска и сканера QR, категории со счётчиками, недавно открытые, быстрые действия, нижняя навигация
(Главная · Поиск · Сохранённые · Категории · Меню). На iPad (≥768 px) вёрстка расширяется.

Все кнопки рабочие:

| Элемент | Что делает |
|---------|-----------|
| Микрофон | Сразу открывает экран прослушивания. Одно точное совпадение — открывается карта, несколько — список результатов |
| Сканер | Камера + jsQR; также код/ссылка вручную и фото с QR |
| Калькуляция | Себестоимость порции по всем картам, сортировка, переход в расчёт карты |
| Импорт PDF/Фото | OCR на устройстве (tesseract.js, rus+eng), PDF через pdf.js; результат сохраняется как черновик |
| QR-код карты | Генерация QR (PNG, ссылка, «Поделиться») |
| Офлайн-режим | Сохранение карт в IndexedDB, статус кэша, очистка, обновление |
| Колокольчик | Уведомления о статусе данных/сети/черновиках |

Иконки — собственный SVG-набор (`src/components/Icons.tsx`), без внешних библиотек и emoji. Тяжёлые модули (OCR, PDF, QR)
подгружаются только при открытии соответствующего экрана.

Фото блюд в mock-данных подгружаются с `loremflickr.com` по тегам блюда; если фото не загрузилось или нет сети,
показывается SVG-иллюстрация блюда (`src/components/RecipeImage.tsx`). Для карт с сервера используется `imageUrl`.
Баннеры лежат в `public/banners/`.

## Tuzilma

```
src/
  App.tsx               — asosiy UI (ekranlar, ovozli qidiruv oqimi)
  components/Icons.tsx  — SVG ikonlar
  components/Banner.tsx — баннер-карусель
  screens/Tools.tsx     — сканер, QR, калькуляция, импорт, офлайн
  components/RecipeImage.tsx — foto + SVG illyustratsiya
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


---

## Умный сканер документов (Smart Document Scanner)

Экран «Сканер документов» (кнопка сканера на главной, «Импорт (PDF/Фото)», меню): режимы **Камера / Фото / PDF / QR-код**. Документ определяется автоматически, выпрямляется, читается локальным OCR (без интернета), результат обязательно проверяется пользователем и сохраняется только после подтверждения. Подробности и правила точности — в [`docs/IMPORT_API.md`](docs/IMPORT_API.md).

**Измеренная точность (честно):** на единственном тестовом документе (технологическая карта, 11 строк × 4 числовых столбца = 44 числа) все цифры прочитаны верно (44/44), но в 6 числах «,» прочитана как «.» — они помечены жёлтым/красным, молчаливых ошибок 0. Это выборка n=1; набор из 30+ документов и замеры на реальных фото iPhone/iPad не проводились.

> Модели OCR (~14 МБ) копируются в `public/tesseract/` при `npm install`/сборке (`scripts/copy-ocr.mjs`) и не хранятся в git.
