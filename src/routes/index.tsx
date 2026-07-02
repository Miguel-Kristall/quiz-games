import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { recommendGames, type Recommendation } from "@/lib/recommend.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Gamepad2, Sparkles, X, ArrowRight, ArrowLeft, RotateCcw, ExternalLink, Plus, Clock, Trophy, ThumbsUp, Youtube, Star, Wand2 } from "lucide-react";

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
  key: "genres" | "platforms" | "sessionLength" | "playStyle" | "mood" | "visual" | "challenge" | "hook";
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
  {
    key: "challenge",
    title: "Nível de desafio preferido?",
    subtitle: "Escolha um",
    multi: false,
    options: [
      { id: "tranquilo", label: "Tranquilo", emoji: "🧘" },
      { id: "equilibrado", label: "Equilibrado", emoji: "⚖️" },
      { id: "punitivo", label: "Punitivo", emoji: "💀" },
    ],
  },
  {
    key: "hook",
    title: "O que mais te prende num jogo?",
    subtitle: "Escolha um",
    multi: false,
    options: [
      { id: "historia", label: "História", emoji: "📖" },
      { id: "gameplay", label: "Gameplay", emoji: "🎯" },
      { id: "mundo", label: "Mundo aberto", emoji: "🌍" },
      { id: "progressao", label: "Progressão / loot", emoji: "💎" },
    ],
  },
];

type Answers = Record<string, string[]>;

function App() {
  const [phase, setPhase] = useState<"intro" | "quiz" | "games" | "loading" | "results">("intro");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [favoriteGames, setFavoriteGames] = useState<string[]>([]);
  const [results, setResults] = useState<Recommendation[]>([]);
  const [excludeNames, setExcludeNames] = useState<string[]>([]);
  const [likedNames, setLikedNames] = useState<string[]>([]);
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function runRecommend() {
    setPhase("loading");
    setError(null);
    setPlatformFilter(null);
    const r = await recommend({
      data: {
        genres: answers.genres ?? [],
        platforms: answers.platforms ?? [],
        sessionLength: answers.sessionLength?.[0] ?? "",
        playStyle: answers.playStyle?.[0] ?? "",
        mood: answers.mood?.[0] ?? "",
        visual: answers.visual?.[0] ?? "",
        challenge: answers.challenge?.[0] ?? "",
        hook: answers.hook?.[0] ?? "",
        favoriteGames,
        liked: likedNames,
        exclude: excludeNames,
      },
    });
    setExcludeNames((prev) => [...prev, ...r.results.map((g) => g.nome)]);
    setResults(r.results);
    setError(r.error ?? null);
    setPhase("results");
  }

  function dismissOne(idx: number, name: string) {
    setResults((prev) => prev.filter((_, i) => i !== idx));
    setExcludeNames((prev) => [...prev, name]);
    setLikedNames((prev) => prev.filter((n) => n !== name));
  }

  function likeOne(name: string) {
    setLikedNames((prev) => (prev.includes(name) ? prev : [...prev, name]));
  }

  function reset() {
    setPhase("intro");
    setStep(0);
    setAnswers({});
    setFavoriteGames([]);
    setResults([]);
    setExcludeNames([]);
    setLikedNames([]);
    setPlatformFilter(null);
    setError(null);
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
        {phase !== "intro" ? (
          <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">
            <RotateCcw className="w-4 h-4 mr-2" /> Recomeçar
          </Button>
        ) : (
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link to="/trivia"><Sparkles className="w-4 h-4 mr-2" /> Trivia</Link>
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
              nextLabel="Próximo"
            />
          </div>
        )}

        {phase === "games" && (
          <div className="animate-fade-up">
            <ProgressBar value={progress} step={totalSteps + 1} total={totalSteps + 1} />
            <GamesStep favoriteGames={favoriteGames} setFavoriteGames={setFavoriteGames} />
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
            error={error}
            likedNames={likedNames}
            platformFilter={platformFilter}
            setPlatformFilter={setPlatformFilter}
            onDismiss={dismissOne}
            onLike={likeOne}
            onAgain={() => runRecommend()}
          />
        )}
      </main>

      <footer className="text-center text-xs text-muted-foreground py-6">
        Recomendações geradas por IA
      </footer>
    </div>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="text-center py-16 md:py-24 animate-fade-up">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full card-glow text-xs font-semibold text-muted-foreground mb-8">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        Quiz inteligente · Powered by Claude
      </div>
      <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-[1.05]">
        Descubra o seu <br />
        <span className="text-gradient">próximo jogo favorito</span>
      </h1>
      <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10">
        Responda 8 perguntas rápidas, conte o que você já jogou, e a IA entrega 5 recomendações sob medida.
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
  favoriteGames,
  setFavoriteGames,
}: {
  favoriteGames: string[];
  setFavoriteGames: (g: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function add() {
    const name = input.trim();
    if (!name) return;
    if (favoriteGames.some((g) => g.toLowerCase() === name.toLowerCase())) return;
    setFavoriteGames([...favoriteGames, name]);
    setInput("");
  }
  function remove(name: string) {
    setFavoriteGames(favoriteGames.filter((g) => g !== name));
  }

  return (
    <div className="animate-fade-up">
      <h2 className="text-3xl md:text-4xl font-bold mb-2">Quais jogos você já amou?</h2>
      <p className="text-muted-foreground mb-8">
        Digite alguns favoritos para refinar as recomendações. <span className="opacity-70">(opcional)</span>
      </p>

      <div className="flex gap-2 max-w-xl">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Ex: Hollow Knight"
          className="h-12 bg-input border-border"
        />
        <Button onClick={add} disabled={!input.trim()} className="btn-hero h-12 px-5 rounded-xl font-bold">
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      </div>

      {favoriteGames.length > 0 && (
        <div className="mt-8">
          <div className="text-sm font-semibold text-muted-foreground mb-3">Seus jogos ({favoriteGames.length})</div>
          <div className="flex flex-wrap gap-2">
            {favoriteGames.map((g) => (
              <div key={g} className="chip chip-active">
                {g}
                <button onClick={() => remove(g)} aria-label="Remover" className="ml-1 opacity-80 hover:opacity-100">
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
      <p className="text-muted-foreground">A IA está escolhendo seus jogos</p>
    </div>
  );
}

function Results({
  games,
  error,
  likedNames,
  platformFilter,
  setPlatformFilter,
  onDismiss,
  onLike,
  onAgain,
}: {
  games: Recommendation[];
  error: string | null;
  likedNames: string[];
  platformFilter: string | null;
  setPlatformFilter: (p: string | null) => void;
  onDismiss: (idx: number, name: string) => void;
  onLike: (name: string) => void;
  onAgain: () => void;
}) {
  const availablePlatforms = useMemo(() => {
    const s = new Set<string>();
    games.forEach((g) => g.plataformas.forEach((p) => s.add(p)));
    return Array.from(s).sort();
  }, [games]);

  const filtered = platformFilter
    ? games.filter((g) => g.plataformas.includes(platformFilter))
    : games;

  if (error && games.length === 0) {
    return (
      <div className="py-20 text-center animate-fade-up">
        <h2 className="text-2xl font-bold mb-2">Ops! Algo deu errado</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={onAgain} className="btn-hero rounded-full">Tentar novamente</Button>
      </div>
    );
  }
  if (games.length === 0) {
    return (
      <div className="py-20 text-center animate-fade-up">
        <h2 className="text-2xl font-bold mb-2">Sem mais sugestões</h2>
        <p className="text-muted-foreground mb-6">Gere uma nova rodada com base no seu perfil.</p>
        <Button onClick={onAgain} className="btn-hero rounded-full">Gerar novas</Button>
      </div>
    );
  }
  return (
    <div className="animate-fade-up">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full card-glow text-xs font-semibold text-muted-foreground mb-4">
          <Sparkles className="w-3.5 h-3.5 text-primary" /> Recomendações pra você
        </div>
        <h2 className="text-4xl md:text-5xl font-bold">Seus <span className="text-gradient">próximos jogos</span></h2>
        {likedNames.length > 0 && (
          <p className="text-sm text-muted-foreground mt-3">
            {likedNames.length} curtido{likedNames.length > 1 ? "s" : ""} — vamos usar como referência.
          </p>
        )}
      </div>

      {availablePlatforms.length > 1 && (
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          <button
            onClick={() => setPlatformFilter(null)}
            className={`chip ${platformFilter === null ? "chip-active" : ""}`}
          >
            Todas
          </button>
          {availablePlatforms.map((p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p === platformFilter ? null : p)}
              className={`chip ${platformFilter === p ? "chip-active" : ""}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {filtered.map((g) => {
          const originalIdx = games.indexOf(g);
          return (
            <GameCard
              key={`${g.nome}-${originalIdx}`}
              game={g}
              index={originalIdx}
              liked={likedNames.includes(g.nome)}
              onDismiss={() => onDismiss(originalIdx, g.nome)}
              onLike={() => onLike(g.nome)}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 justify-center mt-10">
        <Button
          onClick={onAgain}
          disabled={likedNames.length === 0}
          className="btn-hero rounded-full h-11 px-5 font-bold"
        >
          <Wand2 className="w-4 h-4 mr-2" /> Mais parecidos com curtidos
        </Button>
        <Button variant="ghost" onClick={onAgain}>
          <RotateCcw className="w-4 h-4 mr-2" /> Gerar outras sugestões
        </Button>
      </div>
    </div>
  );
}

function difficultyTone(d: string): string {
  const k = d.toLowerCase();
  if (k.includes("fácil") || k.includes("facil")) return "text-emerald-400";
  if (k.includes("difíc") || k.includes("dific")) return "text-rose-400";
  return "text-amber-400";
}

function scoreTone(n: number): string {
  if (n >= 8.5) return "text-emerald-400 border-emerald-400/40 bg-emerald-400/10";
  if (n >= 7) return "text-amber-400 border-amber-400/40 bg-amber-400/10";
  return "text-rose-400 border-rose-400/40 bg-rose-400/10";
}

function GameCard({
  game,
  index,
  liked,
  onDismiss,
  onLike,
}: {
  game: Recommendation;
  index: number;
  liked: boolean;
  onDismiss: () => void;
  onLike: () => void;
}) {
  return (
    <div className="card-glow rounded-2xl p-6 flex flex-col animate-fade-up" style={{ animationDelay: `${index * 70}ms` }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h3 className="text-2xl font-bold leading-tight">{game.nome}</h3>
          {game.ano ? <div className="text-xs text-muted-foreground mt-0.5">{game.ano}</div> : null}
        </div>
        {typeof game.nota === "number" && (
          <div className={`shrink-0 flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border ${scoreTone(game.nota)}`}>
            <Star className="w-3 h-3 fill-current" />
            {game.nota.toFixed(1)}
          </div>
        )}
      </div>

      <div className="text-xs uppercase tracking-wider font-bold text-primary mb-3">{game.genero}</div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {game.plataformas.map((p) => (
          <span key={p} className="text-[11px] font-semibold px-2 py-0.5 rounded bg-secondary text-secondary-foreground">{p}</span>
        ))}
      </div>

      {game.destaques && game.destaques.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {game.destaques.map((d) => (
            <span key={d} className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-border text-muted-foreground">
              {d}
            </span>
          ))}
        </div>
      )}

      {game.porqueVoceVaiGostar && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 mb-4">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary mb-1">
            <Sparkles className="w-3 h-3" /> Por que você vai gostar
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">{game.porqueVoceVaiGostar}</p>
        </div>
      )}

      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{game.descricao}</p>

      <div className="flex gap-4 text-xs mb-5">
        <div className="flex items-center gap-1.5">
          <Trophy className={`w-3.5 h-3.5 ${difficultyTone(game.dificuldade)}`} />
          <span className={`font-bold ${difficultyTone(game.dificuldade)}`}>{game.dificuldade}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-accent" />
          <span className="font-bold text-foreground">{game.tempoMedio}</span>
        </div>
      </div>

      <div className="flex gap-2 mt-auto">
        <Button asChild className="btn-hero rounded-full flex-1">
          <a href={game.linkBusca} target="_blank" rel="noreferrer">
            Ver na Steam <ExternalLink className="w-3.5 h-3.5 ml-2" />
          </a>
        </Button>
        {game.linkYoutube && (
          <Button asChild variant="ghost" size="icon" aria-label="Ver trailer">
            <a href={game.linkYoutube} target="_blank" rel="noreferrer">
              <Youtube className="w-4 h-4" />
            </a>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onLike}
          aria-label="Mais como este"
          className={liked ? "text-primary" : ""}
        >
          <ThumbsUp className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDismiss} aria-label="Não me interessa">
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
