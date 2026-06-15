import { createServerFn } from "@tanstack/react-start";

export interface Recommendation {
  nome: string;
  genero: string;
  plataformas: string[];
  descricao: string;
  dificuldade: string;
  tempoMedio: string;
  linkBusca: string;
}

export interface RecommendInput {
  genres: string[];
  platforms: string[];
  sessionLength: string;
  playStyle: string;
  mood: string;
  visual: string;
  favoriteGames: string[];
  exclude: string[];
}

const GENRE_LABEL: Record<string, string> = {
  acao: "Ação", rpg: "RPG", puzzle: "Puzzle", terror: "Terror",
  esporte: "Esporte", estrategia: "Estratégia", aventura: "Aventura",
  indie: "Indie", corrida: "Corrida", simulacao: "Simulação",
};
const PLATFORM_LABEL: Record<string, string> = {
  pc: "PC", ps5: "PS5", ps4: "PS4", xbox: "Xbox Series",
  xboxone: "Xbox One", switch: "Switch", mobile: "Mobile",
};
const SESSION_LABEL: Record<string, string> = {
  curta: "menos de 1h", media: "1 a 3h", longa: "4h ou mais",
};
const STYLE_LABEL: Record<string, string> = {
  solo: "solo", coop: "cooperativo", competitivo: "competitivo",
};
const MOOD_LABEL: Record<string, string> = {
  relaxar: "relaxar", desafio: "desafio intenso",
  explorar: "explorar", socializar: "socializar",
};
const VISUAL_LABEL: Record<string, string> = {
  pixel: "pixel art", realista: "realista",
  cartoon: "cartoon", abstrato: "abstrato",
};

function buildPrompt(d: RecommendInput): string {
  const genres = d.genres.map((g) => GENRE_LABEL[g] ?? g).join(", ") || "qualquer";
  const platforms = d.platforms.map((p) => PLATFORM_LABEL[p] ?? p).join(", ") || "qualquer";
  const fav = d.favoriteGames.length ? d.favoriteGames.join("; ") : "(não informou)";
  const excludeLine = d.exclude.length
    ? `\nNão recomende novamente nenhum destes jogos: ${d.exclude.join("; ")}.`
    : "";

  return `Você é um especialista em recomendação de videogames. Com base no perfil abaixo, recomende EXATAMENTE 5 jogos.

PERFIL DO JOGADOR:
- Gêneros favoritos: ${genres}
- Plataformas disponíveis: ${platforms}
- Tempo por sessão: ${SESSION_LABEL[d.sessionLength] ?? "qualquer"}
- Estilo de jogo: ${STYLE_LABEL[d.playStyle] ?? "qualquer"}
- Humor atual: ${MOOD_LABEL[d.mood] ?? "qualquer"}
- Preferência visual: ${VISUAL_LABEL[d.visual] ?? "qualquer"}
- Jogos que ele já curtiu: ${fav}${excludeLine}

Responda APENAS com um array JSON válido (sem markdown, sem comentários, sem texto antes ou depois), seguindo EXATAMENTE este formato:
[
  {
    "nome": "Nome do Jogo",
    "genero": "RPG, Ação",
    "plataformas": ["PC", "PS5"],
    "descricao": "Por que você vai gostar... (2 frases, em português)",
    "dificuldade": "Médio",
    "tempoMedio": "40h",
    "linkBusca": "https://store.steampowered.com/search/?term=Nome+do+Jogo"
  }
]

Regras:
- Exatamente 5 itens.
- "dificuldade" deve ser "Fácil", "Médio" ou "Difícil".
- "linkBusca" sempre no formato https://store.steampowered.com/search/?term=NOME (espaços viram +).
- "plataformas" apenas das que o jogador tem disponíveis.
- "descricao" personalizada conectando o jogo ao perfil do jogador.`;
}

export const recommendGames = createServerFn({ method: "POST" })
  .inputValidator((d: RecommendInput) => d)
  .handler(async ({ data }) => {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return { results: [] as Recommendation[], error: "ANTHROPIC_API_KEY não configurada" };
    }

    const prompt = buildPrompt(data);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error("Anthropic error", r.status, txt);
      return { results: [] as Recommendation[], error: `Anthropic ${r.status}` };
    }

    const j = (await r.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = j.content?.map((c) => c.text ?? "").join("") ?? "";

    // Extract JSON array from response
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return { results: [] as Recommendation[], error: "Resposta inválida do modelo" };
    }

    try {
      const parsed = JSON.parse(match[0]) as Recommendation[];
      return { results: parsed.slice(0, 5), error: null };
    } catch (e) {
      console.error("JSON parse error", e);
      return { results: [] as Recommendation[], error: "Falha ao interpretar resposta" };
    }
  });
