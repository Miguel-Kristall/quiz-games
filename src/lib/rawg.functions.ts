import { createServerFn } from "@tanstack/react-start";

export interface RawgGame {
  id: number;
  slug: string;
  name: string;
  background_image: string | null;
  rating: number;
  released: string | null;
  genres?: { id: number; name: string; slug: string }[];
  platforms?: { platform: { id: number; name: string; slug: string } }[];
  stores?: { store: { id: number; name: string; slug: string }; url?: string }[];
  short_screenshots?: { id: number; image: string }[];
}

const BASE = "https://api.rawg.io/api";

function key(): string {
  const k = process.env.RAWG_API_KEY;
  if (!k) throw new Error("RAWG_API_KEY not configured");
  return k;
}

export const searchGames = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ data }) => {
    if (!data.q.trim()) return { results: [] as RawgGame[] };
    const url = `${BASE}/games?key=${key()}&search=${encodeURIComponent(data.q)}&page_size=6&search_precise=true`;
    const r = await fetch(url);
    if (!r.ok) return { results: [] as RawgGame[] };
    const j = (await r.json()) as { results: RawgGame[] };
    return { results: j.results ?? [] };
  });

export interface RecommendInput {
  genres: string[];
  platforms: string[];
  sessionLength: string;
  playStyle: string;
  mood: string;
  visual: string;
  seedGameIds: number[];
  excludeIds: number[];
}

// Map our UI tokens to RAWG slug
const GENRE_MAP: Record<string, string> = {
  acao: "action",
  rpg: "role-playing-games-rpg",
  puzzle: "puzzle",
  terror: "shooter", // fallback; tags include horror
  esporte: "sports",
  estrategia: "strategy",
  aventura: "adventure",
  indie: "indie",
  corrida: "racing",
  simulacao: "simulation",
};
const PLATFORM_MAP: Record<string, string> = {
  pc: "4",
  ps5: "187",
  ps4: "18",
  xbox: "1",
  xboxone: "80",
  switch: "7",
  mobile: "21,3",
};
const TAG_BY_MOOD: Record<string, string> = {
  relaxar: "relaxing",
  desafio: "difficult",
  explorar: "open-world",
  socializar: "multiplayer",
};

export const recommendGames = createServerFn({ method: "POST" })
  .inputValidator((d: RecommendInput) => d)
  .handler(async ({ data }) => {
    const params = new URLSearchParams();
    params.set("key", key());
    params.set("page_size", "20");
    params.set("ordering", "-rating");
    params.set("metacritic", "70,100");

    const genreSlugs = data.genres.map((g) => GENRE_MAP[g]).filter(Boolean);
    if (data.genres.includes("terror")) genreSlugs.push("shooter");
    if (genreSlugs.length) params.set("genres", genreSlugs.join(","));

    const platIds = data.platforms.map((p) => PLATFORM_MAP[p]).filter(Boolean);
    if (platIds.length) params.set("parent_platforms", platIds.join(","));

    const tags: string[] = [];
    if (data.playStyle === "coop") tags.push("co-op");
    if (data.playStyle === "competitivo") tags.push("multiplayer");
    if (data.playStyle === "solo") tags.push("singleplayer");
    if (TAG_BY_MOOD[data.mood]) tags.push(TAG_BY_MOOD[data.mood]);
    if (data.visual === "pixel") tags.push("pixel-graphics");
    if (data.visual === "cartoon") tags.push("cartoon");
    if (tags.length) params.set("tags", tags.join(","));

    const url = `${BASE}/games?${params.toString()}`;
    const r = await fetch(url);
    if (!r.ok) return { results: [] as RawgGame[], reason: "api_error" };
    const j = (await r.json()) as { results: RawgGame[] };

    const seedSet = new Set(data.seedGameIds);
    const excludeSet = new Set(data.excludeIds);
    const filtered = (j.results ?? []).filter(
      (g) => !seedSet.has(g.id) && !excludeSet.has(g.id) && g.background_image,
    );

    return { results: filtered.slice(0, 5), reason: "ok" as const };
  });

export const getGameDetail = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    const r = await fetch(`${BASE}/games/${data.id}?key=${key()}`);
    if (!r.ok) return null;
    return (await r.json()) as RawgGame & { description_raw?: string };
  });
