import { createServerFn } from "@tanstack/react-start";

export interface Recommendation {
  nome: string;
  genero: string;
  plataformas: string[];
  descricao: string;
  dificuldade: string;
  tempoMedio: string;
  linkBusca: string;
  ano: number;
  nota: number;
  porqueVoceVaiGostar: string;
  destaques: string[];
  linkYoutube: string;
}

export interface RecommendInput {
  genres: string[];
  platforms: string[];
  sessionLength: string;
  playStyle: string;
  mood: string;
  visual: string;
  challenge: string;
  hook: string;
  favoriteGames: string[];
  liked: string[];
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
const CHALLENGE_LABEL: Record<string, string> = {
  tranquilo: "tranquilo, sem punição",
  equilibrado: "equilibrado, desafio justo",
  punitivo: "punitivo, tipo souls-like",
};
const HOOK_LABEL: Record<string, string> = {
  historia: "história e personagens",
  gameplay: "gameplay refinado",
  mundo: "mundo aberto e exploração",
  progressao: "progressão, loot e builds",
};

function buildPrompt(d: RecommendInput): string {
  const genres = d.genres.map((g) => GENRE_LABEL[g] ?? g).join(", ") || "qualquer";
  const platforms = d.platforms.map((p) => PLATFORM_LABEL[p] ?? p).join(", ") || "qualquer";
  const fav = d.favoriteGames.length ? d.favoriteGames.join("; ") : "(não informou)";
  const excludeLine = d.exclude.length
    ? `\nNão recomende novamente nenhum destes jogos: ${d.exclude.join("; ")}.`
    : "";
  const likedLine = d.liked.length
    ? `\nO usuário ADOROU estes jogos das rodadas anteriores — traga jogos com vibe/qualidade parecidas: ${d.liked.join("; ")}.`
    : "";

  return `Você é um especialista em recomendação de videogames. Com base no perfil abaixo, recomende EXATAMENTE 5 jogos.

PERFIL DO JOGADOR:
- Gêneros favoritos: ${genres}
- Plataformas disponíveis: ${platforms}
- Tempo por sessão: ${SESSION_LABEL[d.sessionLength] ?? "qualquer"}
- Estilo de jogo: ${STYLE_LABEL[d.playStyle] ?? "qualquer"}
- Humor atual: ${MOOD_LABEL[d.mood] ?? "qualquer"}
- Preferência visual: ${VISUAL_LABEL[d.visual] ?? "qualquer"}
- Nível de desafio preferido: ${CHALLENGE_LABEL[d.challenge] ?? "qualquer"}
- O que mais o prende num jogo: ${HOOK_LABEL[d.hook] ?? "qualquer"}
- Jogos que ele já curtiu: ${fav}${likedLine}${excludeLine}

Responda APENAS com um array JSON válido (sem markdown, sem comentários, sem texto antes ou depois), seguindo EXATAMENTE este formato:
[
  {
    "nome": "Nome do Jogo",
    "genero": "RPG, Ação",
    "plataformas": ["PC", "PS5"],
    "ano": 2020,
    "nota": 8.7,
    "dificuldade": "Médio",
    "tempoMedio": "40h",
    "porqueVoceVaiGostar": "Uma frase direta conectando ao perfil do jogador.",
    "descricao": "2 frases descrevendo o jogo em si, em português.",
    "destaques": ["Trilha sonora incrível", "Combate satisfatório", "Mundo memorável"],
    "linkBusca": "https://store.steampowered.com/search/?term=Nome+do+Jogo",
    "linkYoutube": "https://www.youtube.com/results?search_query=Nome+do+Jogo+trailer"
  }
]

Regras:
- Exatamente 5 itens.
- "dificuldade" deve ser "Fácil", "Médio" ou "Difícil".
- "nota" é um número entre 0 e 10 (uma casa decimal) refletindo a recepção geral da comunidade.
- "ano" é o ano de lançamento original (número).
- "destaques" tem 2 ou 3 tags CURTAS (2-4 palavras cada).
- "porqueVoceVaiGostar" é UMA frase personalizada conectando ao perfil.
- "descricao" descreve o jogo em si, sem repetir o "porqueVoceVaiGostar".
- "linkBusca" sempre https://store.steampowered.com/search/?term=NOME (espaços viram +).
- "linkYoutube" sempre https://www.youtube.com/results?search_query=NOME+trailer (espaços viram +).
- "plataformas" apenas das que o jogador tem disponíveis.`;
}

export const recommendGames = createServerFn({ method: "POST" })
  .inputValidator((d: RecommendInput) => d)
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return { results: [] as Recommendation[], error: "LOVABLE_API_KEY não configurada" };
    }

    const prompt = buildPrompt(data);

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error("Lovable AI Gateway error", r.status, txt);
      if (r.status === 429) {
        return { results: [] as Recommendation[], error: "Limite de requisições atingido. Tente novamente em instantes." };
      }
      if (r.status === 402) {
        return { results: [] as Recommendation[], error: "Créditos de IA esgotados. Adicione créditos ao workspace." };
      }
      return { results: [] as Recommendation[], error: `Gateway ${r.status}` };
    }

    const j = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = j.choices?.[0]?.message?.content ?? "";

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
