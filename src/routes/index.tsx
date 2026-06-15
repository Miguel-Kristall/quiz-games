import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchGames, recommendGames, type RawgGame } from "@/lib/rawg.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Gamepad2, Search, Sparkles, Star, X, ArrowRight, ArrowLeft, RotateCcw, ExternalLink, Plus } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Qual Jogo Jogar? — Descubra seu próximo game" },
      { name: "description", content: "Quiz interativo que recomenda o próximo jogo perfeito para você com base no seu gosto e histórico." },
      { property: "og:title", content: "Qual Jogo Jogar?" },
      { property: "og:description", content: "Quiz inteligente para descobrir seu próximo jogo favorito." },
    ],
  }),
  component: App,
});

type Option = { id: string; label: string; emoji?: string };

const QUESTIONS: {
  key: "genres" | "platforms" | "sessionLength" | "playStyle" | "mood" | "visual";
  title: string;
  subtitle: string;
  multi: boolean;
  options: Option[];
}[] = [
  {
    key: "genres",
    title: "Quais gêneros te puxam?",
    subtitle: "Escolha quantos quiser",
    multi: true,
    options: [
      { id: "acao", label: "Ação", emoji: "⚔️" },
      { id: "rpg", label: "RPG", emoji: "🧙" },
      { id: "puzzle", label: "Puzzle", emoji: "🧩" },
      { id: "terror", label: "Terror", emoji: "👻" },
      { id: "esporte", label: "Esporte", emoji: "⚽" },
      { id: "estrategia", label: "Estratégia", emoji: "♟️" },
      { id: "aventura", label: "Aventura", emoji: "🗺️" },
      { id: "indie", label: "Indie", emoji: "✨" },
      { id: "corrida", label: "Corrida", emoji: "🏎️" },
      { id: "simulacao", label: "Simulação", emoji: "🛠️" },
    ],
  },
  {
    key: "platforms",
    title: "Onde você joga?",
    subtitle: "Suas plataformas disponíveis",
    multi: true,
    options: [
      { id: "pc", label: "PC", emoji: "💻" },
      { id: "ps5", label: "PS5", emoji: "🎮" },
      { id: "ps4", label: "PS4", emoji: "🎮" },
      { id: "xbox", label: "Xbox Series", emoji: "🎮" },
      { id: "xboxone", label: "Xbox One", emoji: "🎮" },
      { id: "switch", label: "Switch", emoji: "🎮" },
      { id: "mobile", label: "Mobile", emoji: "📱" },
    ],
  },
  {
    key: "sessionLength",
    title: "Quanto tempo por sessão?",
    subtitle: "Escolha uma",
    multi: false,
    options: [
      { id: "curta", label: "Menos de 1h", emoji: "⏱️" },
      { id: "media", label: "1 a 3h", emoji: "⏳" },
      { id: "longa", label: "4h ou mais", emoji: "🌙" },
    ],
  },
  {
    key: "playStyle",
    title: "Como prefere jogar?",
    subtitle: "Escolha uma",
    multi: false,
    options: [
      { id: "solo", label: "Solo", emoji: "🧍" },
      { id: "coop", label: "Cooperativo", emoji: "🤝" },
      { id: "competitivo", label: "Competitivo", emoji: "🏆" },
    ],
  },
  {
    key: "mood",
    title: "Qual seu humor agora?",
    subtitle: "Escolha um",
    multi: false,
    options: [
      { id: "relaxar", label: "Relaxar", emoji: "🌿" },
      { id: "desafio", label: "Desafio intenso", emoji: "🔥" },
      { id: "explorar", label: "Explorar", emoji: "🧭" },
      { id: "socializar", label: "Socializar", emoji: "💬" },
    ],
  },
  {
    key: "visual",
    title: "Que vibe visual?",
    subtitle: "Escolha um",
    multi: false,
    options: [
      { id: "pixel", label: "Pixel art", emoji: "🟦" },
      { id: "realista", label: "Realista", emoji: "🎬" },
      { id: "cartoon", label: "Cartoon", emoji: "🎨" },
      { id: "abstrato", label: "Abstrato", emoji: "🌀" },
    ],
  },
];

type Answers = Record<string, string[]>;

function App() {
  const [phase, setPhase] = useState<"intro" | "quiz" | "games" | "loading" | "results">("intro");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [seedGames, setSeedGames] = useState<RawgGame[]>([]);
  const [results, setResults] = useState<RawgGame[]>([]);
  const [excludeIds, setExcludeIds] = useState<number[]>([]);
  const [replacing, setReplacing] = useState<number | null>(null);

  const recommend = useServerFn(recommendGames);

  const totalSteps = QUESTIONS.length;
  const progress = phase === "quiz"
    ? ((step + 1) / (totalSteps + 1)) * 100
    : phase === "games"
    ? 100
    : 0;

  function toggleAnswer(qKey: string, optId: string, multi: boolean) {
    setAnswers((prev) => {
      const cur = prev[qKey] ?? [];
      if (multi) {
        return { ...prev, [qKey]: cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId] };
      }
      return { ...prev, [qKey]: [optId] };
    });
  }

  async function runRecommend(extraExclude: number[] = []) {
    setPhase("loading");
    const ex = [...excludeIds, ...extraExclude];
    const r = await recommend({
      data: {
        genres: answers.genres ?? [],
        platforms: answers.platforms ?? [],
        sessionLength: answers.sessionLength?.[0] ?? "",
        playStyle: answers.playStyle?.[0] ?? "",
        mood: answers.mood?.[0] ?? "",
        visual: answers.visual?.[0] ?? "",
        seedGameIds: seedGames.map((g) => g.id),
        excludeIds: ex,
      },
    });
    setExcludeIds([...ex, ...r.results.map((g) => g.id)]);
    setResults(r.results);
    setPhase("results");
  }

  async function replaceOne(idx: number, gameId: number) {
    setReplacing(idx);
    const ex = [...excludeIds, gameId];
    const r = await recommend({
      data: {
        genres: answers.genres ?? [],
        platforms: answers.platforms ?? [],
        sessionLength: answers.sessionLength?.[0] ?? "",
        playStyle: answers.playStyle?.[0] ?? "",
        mood: answers.mood?.[0] ?? "",
        visual: answers.visual?.[0] ?? "",
        seedGameIds: seedGames.map((g) => g.id),
        excludeIds: ex,
      },
    });
    const next = r.results.find((g) => !results.some((x) => x.id === g.id));
    if (next) {
      setResults((prev) => prev.map((g, i) => (i === idx ? next : g)));
      setExcludeIds([...ex, next.id]);
    } else {
      setExcludeIds(ex);
    }
    setReplacing(null);
  }

  function reset() {
    setPhase("intro");
    setStep(0);
    setAnswers({});
    setSeedGames([]);
    setResults([]);
    setExcludeIds([]);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="max-w-6xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center btn-hero">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">Qual Jogo Jogar?</span>
        </div>
        {phase !== "intro" && (
          <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">
            <RotateCcw className="w-4 h-4 mr-2" /> Recomeçar
          </Button>
        )}
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 pb-16">
        {phase === "intro" && <Intro onStart={() => setPhase("quiz")} />}

        {phase === "quiz" && (
          <div className="animate-fade-up">
            <ProgressBar value={progress} step={step + 1} total={totalSteps + 1} />
            <QuizStep
              q={QUESTIONS[step]}
              selected={answers[QUESTIONS[step].key] ?? []}
              onToggle={(id) => toggleAnswer(QUESTIONS[step].key, id, QUESTIONS[step].multi)}
            />
            <NavButtons
              canBack={step > 0}
              canNext={(answers[QUESTIONS[step].key]?.length ?? 0) > 0}
              onBack={() => setStep((s) => Math.max(0, s - 1))}
              onNext={() => {
                if (step < totalSteps - 1) setStep(step + 1);
                else setPhase("games");
              }}
              nextLabel={step === totalSteps - 1 ? "Próximo" : "Próximo"}
            />
          </div>
        )}

        {phase === "games" && (
          <div className="animate-fade-up">
            <ProgressBar value={progress} step={totalSteps + 1} total={totalSteps + 1} />
            <GamesStep
              seedGames={seedGames}
              setSeedGames={setSeedGames}
            />
            <NavButtons
              canBack
              canNext
              onBack={() => setPhase("quiz")}
              onNext={() => runRecommend()}
              nextLabel="Ver recomendações"
              nextIcon={<Sparkles className="w-4 h-4 ml-2" />}
            />
          </div>
        )}

        {phase === "loading" && <Loading />}

        {phase === "results" && (
          <Results
            games={results}
            onReplace={replaceOne}
            replacing={replacing}
            onAgain={() => runRecommend()}
          />
        )}
      </main>

      <footer className="text-center text-xs text-muted-foreground py-6">
        Dados de jogos via RAWG.io
      </footer>
    </div>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="text-center py-16 md:py-24 animate-fade-up">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full card-glow text-xs font-semibold text-muted-foreground mb-8">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        Quiz inteligente · Powered by RAWG
      </div>
      <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-[1.05]">
        Descubra o seu <br />
        <span className="text-gradient">próximo jogo favorito</span>
      </h1>
      <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10">
        Responda 6 perguntas rápidas, conte o que você já jogou, e a gente entrega 5 recomendações sob medida.
      </p>
      <Button size="lg" onClick={onStart} className="btn-hero text-base px-8 h-14 rounded-full font-bold">
        Começar quiz
        <ArrowRight className="w-5 h-5 ml-2" />
      </Button>
    </div>
  );
}

function ProgressBar({ value, step, total }: { value: number; step: number; total: number }) {
  return (
    <div className="mb-8">
      <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-2">
        <span>Etapa {step} de {total}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}

function QuizStep({
  q,
  selected,
  onToggle,
}: {
  q: (typeof QUESTIONS)[number];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div key={q.key} className="animate-fade-up">
      <h2 className="text-3xl md:text-4xl font-bold mb-2">{q.title}</h2>
      <p className="text-muted-foreground mb-8">{q.subtitle}</p>
      <div className="flex flex-wrap gap-3">
        {q.options.map((opt) => {
          const active = selected.includes(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => onToggle(opt.id)}
              className={`chip ${active ? "chip-active" : ""}`}
            >
              {opt.emoji && <span className="text-base">{opt.emoji}</span>}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NavButtons({
  canBack,
  canNext,
  onBack,
  onNext,
  nextLabel,
  nextIcon,
}: {
  canBack: boolean;
  canNext: boolean;
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  nextIcon?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between mt-12">
      <Button variant="ghost" onClick={onBack} disabled={!canBack}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
      </Button>
      <Button onClick={onNext} disabled={!canNext} className="btn-hero h-12 px-6 rounded-full font-bold">
        {nextLabel} {nextIcon ?? <ArrowRight className="w-4 h-4 ml-2" />}
      </Button>
    </div>
  );
}

function GamesStep({
  seedGames,
  setSeedGames,
}: {
  seedGames: RawgGame[];
  setSeedGames: (g: RawgGame[]) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<RawgGame[]>([]);
  const [searching, setSearching] = useState(false);
  const search = useServerFn(searchGames);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await search({ data: { q } });
      setResults(r.results);
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [q, search]);

  function add(g: RawgGame) {
    if (seedGames.some((x) => x.id === g.id)) return;
    setSeedGames([...seedGames, g]);
    setQ("");
    setResults([]);
  }
  function remove(id: number) {
    setSeedGames(seedGames.filter((g) => g.id !== id));
  }

  return (
    <div className="animate-fade-up">
      <h2 className="text-3xl md:text-4xl font-bold mb-2">Quais jogos você já amou?</h2>
      <p className="text-muted-foreground mb-8">
        Adicione alguns favoritos para refinar as recomendações. <span className="opacity-70">(opcional)</span>
      </p>

      <div className="relative max-w-xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar um jogo, ex: Hollow Knight..."
          className="pl-11 h-12 bg-input border-border"
        />
        {results.length > 0 && (
          <div className="absolute z-20 mt-2 w-full card-glow rounded-xl overflow-hidden">
            {results.map((g) => (
              <button
                key={g.id}
                onClick={() => add(g)}
                className="w-full flex items-center gap-3 p-3 hover:bg-secondary text-left transition"
              >
                {g.background_image ? (
                  <img src={g.background_image} alt={g.name} className="w-12 h-12 rounded-md object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-md bg-secondary" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{g.name}</div>
                  <div className="text-xs text-muted-foreground">{g.released?.slice(0, 4)}</div>
                </div>
                <Plus className="w-4 h-4 text-primary" />
              </button>
            ))}
          </div>
        )}
        {searching && q.trim() && results.length === 0 && (
          <div className="absolute mt-2 text-xs text-muted-foreground">Buscando...</div>
        )}
      </div>

      {seedGames.length > 0 && (
        <div className="mt-10">
          <div className="text-sm font-semibold text-muted-foreground mb-3">Seus jogos ({seedGames.length})</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {seedGames.map((g) => (
              <div key={g.id} className="card-glow rounded-xl overflow-hidden relative group">
                {g.background_image && (
                  <img src={g.background_image} alt={g.name} className="w-full aspect-video object-cover" />
                )}
                <div className="p-3">
                  <div className="font-semibold text-sm truncate">{g.name}</div>
                </div>
                <button
                  onClick={() => remove(g.id)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition"
                  aria-label="Remover"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="py-24 text-center animate-fade-up">
      <div className="inline-flex w-16 h-16 rounded-full btn-hero items-center justify-center animate-pulse-glow mb-6">
        <Sparkles className="w-7 h-7" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Analisando seu perfil...</h2>
      <p className="text-muted-foreground">Encontrando os jogos perfeitos pra você</p>
    </div>
  );
}

function Results({
  games,
  onReplace,
  replacing,
  onAgain,
}: {
  games: RawgGame[];
  onReplace: (idx: number, id: number) => void;
  replacing: number | null;
  onAgain: () => void;
}) {
  if (games.length === 0) {
    return (
      <div className="py-20 text-center animate-fade-up">
        <h2 className="text-2xl font-bold mb-2">Nada encontrado 😕</h2>
        <p className="text-muted-foreground mb-6">Tente afrouxar alguns filtros.</p>
        <Button onClick={onAgain} className="btn-hero rounded-full">Tentar novamente</Button>
      </div>
    );
  }
  return (
    <div className="animate-fade-up">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full card-glow text-xs font-semibold text-muted-foreground mb-4">
          <Sparkles className="w-3.5 h-3.5 text-primary" /> Recomendações pra você
        </div>
        <h2 className="text-4xl md:text-5xl font-bold">Seus <span className="text-gradient">5 próximos jogos</span></h2>
      </div>
      <div className="grid gap-6">
        {games.map((g, i) => (
          <GameCard key={g.id} game={g} index={i} onReplace={() => onReplace(i, g.id)} replacing={replacing === i} />
        ))}
      </div>
    </div>
  );
}

function GameCard({ game, index, onReplace, replacing }: { game: RawgGame; index: number; onReplace: () => void; replacing: boolean }) {
  const reason = useMemo(() => buildReason(game), [game]);
  const steamStore = game.stores?.find((s) => s.store?.slug === "steam");
  const storeUrl = steamStore?.url ?? `https://rawg.io/games/${game.slug}`;

  return (
    <div className="card-glow rounded-2xl overflow-hidden md:flex animate-fade-up" style={{ animationDelay: `${index * 80}ms` }}>
      <div className="md:w-72 md:shrink-0 aspect-video md:aspect-auto relative">
        {game.background_image ? (
          <img src={game.background_image} alt={game.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-secondary" />
        )}
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-background/80 backdrop-blur text-xs font-bold flex items-center gap-1">
          <Star className="w-3 h-3 fill-primary text-primary" />
          {game.rating?.toFixed(1) ?? "—"}
        </div>
      </div>
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h3 className="text-2xl font-bold">{game.name}</h3>
          <div className="text-xs text-muted-foreground font-mono shrink-0">#{index + 1}</div>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {game.genres?.slice(0, 3).map((gn) => (
            <span key={gn.id} className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-secondary text-secondary-foreground">{gn.name}</span>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          <span className="font-semibold text-foreground">Por que vai gostar: </span>{reason}
        </p>
        <div className="text-xs text-muted-foreground mb-4">
          {game.platforms?.slice(0, 5).map((p) => p.platform.name).join(" · ")}
        </div>
        <div className="flex gap-2 mt-auto">
          <Button asChild className="btn-hero rounded-full">
            <a href={storeUrl} target="_blank" rel="noreferrer">
              Jogar agora <ExternalLink className="w-3.5 h-3.5 ml-2" />
            </a>
          </Button>
          <Button variant="ghost" onClick={onReplace} disabled={replacing}>
            {replacing ? "Trocando..." : (<><X className="w-4 h-4 mr-2" /> Não me interessa</>)}
          </Button>
        </div>
      </div>
    </div>
  );
}

function buildReason(g: RawgGame): string {
  const genres = g.genres?.slice(0, 2).map((x) => x.name.toLowerCase()).join(" e ");
  const rating = g.rating ? `nota ${g.rating.toFixed(1)} da comunidade` : "boa aceitação";
  const year = g.released?.slice(0, 4);
  const parts = [
    genres ? `Combina ${genres} com o estilo que você marcou` : "Bate com o perfil que você escolheu",
    `tem ${rating}`,
    year ? `lançado em ${year}` : null,
  ].filter(Boolean);
  return parts.join(" · ") + ".";
}
