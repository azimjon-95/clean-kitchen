/** Иллюстрации категорий (растровые, 220×220 webp, прозрачный фон). Файлы: public/cat/*.webp */
const img = (file: string) => () => <img src={`/cat/${file}.webp`} alt="" width={220} height={220} draggable={false} decoding="async" />;

export const ArtAll = img("vse-bluda");
export const ArtSoup = img("supy");
export const ArtSalad = img("salaty");
export const ArtMain = img("osnovnye");
export const ArtDessert = img("deserty");

export const CAT_ART: Record<string, () => JSX.Element> = { all: ArtAll, soups: ArtSoup, salads: ArtSalad, main: ArtMain, desserts: ArtDessert };
