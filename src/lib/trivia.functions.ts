import { createServerFn } from "@tanstack/react-start";

export interface TriviaQuestion {
  question: string;
  correct: string;
  answers: string[];
}

export interface TriviaInput {
  category: string; // "rpg" | "fps" | "indie" | "retro" | "mobile" | "esports" | "geral" | "todas"
  difficulty: string; // "facil" | "medio" | "dificil"
  exclude: string[]; // perguntas já feitas nesta sessão
}

const CATEGORY_LABEL: Record<string, string> = {
  rpg: "RPG (JRPGs, WRPGs, ARPGs, MMORPGs)",
  fps: "FPS e shooters",
  indie: "jogos indie",
  retro: "clássicos e retrogames (até geração PS2/GameCube)",
  mobile: "jogos mobile",
  esports: "eSports e jogos competitivos",
  geral: "cultura geral de videogames",
  todas: "todas as categorias de videogames",
};

const DIFFICULTY_INSTRUCTIONS: Record<string, string> = {
  facil: "Nível FÁCIL: foque em jogos mainstream, muito populares e conhecidos pelo público casual. Perguntas diretas com respostas óbvias para quem joga há pouco tempo.",
  medio: "Nível MÉDIO: jogos populares mas exigindo conhecimento mais específico (personagens secundários, mecânicas, datas, desenvolvedoras).",
  dificil: "Nível DIFÍCIL: curiosidades obscuras, jogos nichados, easter eggs, detalhes técnicos, jogos cult, referências profundas da cultura gamer.",
};

function buildPrompt(d: TriviaInput): string {
  const cat = CATEGORY_LABEL[d.category] ?? "videogames em geral";
  const diff = DIFFICULTY_INSTRUCTIONS[d.difficulty] ?? DIFFICULTY_INSTRUCTIONS.medio;
  const excludeLine = d.exclude.length
    ? `\n\nNÃO repita nenhuma destas perguntas já feitas nesta sessão (nem variações muito próximas):\n${d.exclude.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
    : "";

  return `Você é um criador de quiz de videogames em português brasileiro. Gere EXATAMENTE 18 perguntas de múltipla escolha sobre: ${cat}.

${diff}${excludeLine}

Responda APENAS com um array JSON válido (sem markdown, sem comentários, sem texto antes ou depois), seguindo EXATAMENTE este formato:
[
  {
    "question": "Texto da pergunta em português.",
    "correct": "Resposta correta",
    "answers": ["Resposta correta", "Alternativa errada 1", "Alternativa errada 2", "Alternativa errada 3"]
  }
]

Regras:
- Exatamente 18 perguntas.
- Cada pergunta tem 4 alternativas em "answers", incluindo a correta.
- "correct" DEVE ser idêntica a uma das strings em "answers".
- Perguntas variadas: personagens, jogos, franquias, empresas, datas, mecânicas, trilhas, dubladores.
- Sem repetir perguntas entre si.
- Tudo em português brasileiro.
- Alternativas plausíveis (não óbvias demais mesmo no fácil).`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const generateTrivia = createServerFn({ method: "POST" })
  .inputValidator((d: TriviaInput) => d)
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return { results: [] as TriviaQuestion[], error: "LOVABLE_API_KEY não configurada" };
    }

    const prompt = buildPrompt(data);

    let r: Response;
    try {
      r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
    } catch (e) {
      console.error("Gateway fetch error", e);
      return { results: [] as TriviaQuestion[], error: "Falha ao conectar ao Lovable AI Gateway." };
    }

    if (!r.ok) {
      const txt = await r.text();
      console.error("Lovable AI Gateway error", r.status, txt);
      if (r.status === 429) {
        return { results: [] as TriviaQuestion[], error: "Limite de requisições atingido. Tente novamente em instantes." };
      }
      if (r.status === 402) {
        return { results: [] as TriviaQuestion[], error: "Créditos de IA esgotados. Adicione créditos ao workspace." };
      }
      return { results: [] as TriviaQuestion[], error: `Gateway ${r.status}` };
    }

    const j = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = j.choices?.[0]?.message?.content ?? "";

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return { results: [] as TriviaQuestion[], error: "Resposta inválida do modelo" };
    }

    try {
      const parsed = JSON.parse(match[0]) as TriviaQuestion[];
      const clean = parsed
        .filter((q) => q?.question && q?.correct && Array.isArray(q.answers) && q.answers.includes(q.correct))
        .map((q) => ({ ...q, answers: shuffle(q.answers) }));
      if (!clean.length) {
        return { results: [] as TriviaQuestion[], error: "Nenhuma pergunta válida gerada." };
      }
      return { results: clean, error: null };
    } catch (e) {
      console.error("JSON parse error", e);
      return { results: [] as TriviaQuestion[], error: "Falha ao interpretar resposta" };
    }
  });
