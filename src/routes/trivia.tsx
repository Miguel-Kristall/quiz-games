import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Gamepad2, Sparkles, RotateCcw, ArrowRight, Trophy, Check, X,
  AlertCircle, WifiOff, Swords, Crosshair, Cpu, Zap, Ghost, Globe, Star,
  Timer as TimerIcon,
} from "lucide-react";

import { generateTrivia, type TriviaQuestion } from "@/lib/trivia.functions";

export const Route = createFileRoute("/trivia")({
  head: () => ({
    meta: [
      { title: "Trivia de Games — Qual Jogo Jogar?" },
      { name: "description", content: "Quiz de trivia sobre videogames com categorias e níveis de dificuldade, gerado por IA." },
      { property: "og:title", content: "Trivia de Games" },
      { property: "og:description", content: "Quiz de trivia sobre videogames." },
    ],
  }),
  component: TriviaPage,
});

const QUESTIONS_PER_ROUND = 18;

const CATEGORIES: { id: string; label: string; icon: typeof Swords; hint: string }[] = [
  { id: "todas", label: "Todas as categorias", icon: Globe, hint: "Modo misto" },
  { id: "rpg", label: "RPG", icon: Swords, hint: "JRPG, ARPG, MMO" },
  { id: "fps", label: "FPS / Ação", icon: Crosshair, hint: "Shooters e ação" },
  { id: "retro", label: "Retrô / Clássicos", icon: Cpu, hint: "Até PS2/GameCube" },
  { id: "indie", label: "Indie", icon: Sparkles, hint: "Jogos independentes" },
  { id: "nintendo", label: "Nintendo", icon: Star, hint: "Mario, Zelda, Pokémon..." },
  { id: "esports", label: "eSports", icon: Zap, hint: "Competitivo" },
  { id: "geral", label: "Cultura Geral", icon: Ghost, hint: "Cultura gamer" },
];

const DIFFICULTIES: { id: string; label: string; hint: string }[] = [
  { id: "facil", label: "Fácil", hint: "Mainstream • 10 pts" },
  { id: "medio", label: "Médio", hint: "Requer conhecimento • 20 pts" },
  { id: "dificil", label: "Difícil", hint: "Nichado • 30 pts" },
];

const POINTS_PER_DIFFICULTY: Record<string, number> = { facil: 10, medio: 20, dificil: 30 };
const TIMER_PER_DIFFICULTY: Record<string, number> = { facil: 15, medio: 20, dificil: 30 };

type Phase = "setup" | "loading" | "playing" | "finished" | "error";
type ErrorKind = "timeout" | "error" | "empty";

const TIMEOUT_SENTINEL = "__timeout__";

const STORAGE_KEY = "trivia_asked_questions";
const HISTORY_KEY = "trivia_history";
const MAX_STORED = 200;
const MAX_HISTORY = 10;
const REQUEST_TIMEOUT_MS = 45000;

export interface HistoryEntry {
  date: number;
  category: string;
  difficulty: string;
  score: number;
  total: number;
  points: number;
  maxPoints: number;
}

function loadAsked(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MAX_STORED) : [];
  } catch {
    return [];
  }
}

function saveAsked(list: string[]) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = list.slice(-MAX_STORED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistoryEntry(entry: HistoryEntry) {
  if (typeof window === "undefined") return;
  try {
    const list = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function clearHistory() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

function formatDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "";
  }
}


function TriviaPage() {
  const gen = useServerFn(generateTrivia);
  const [phase, setPhase] = useState<Phase>("setup");
  const [category, setCategory] = useState<string>("todas");
  const [difficulty, setDifficulty] = useState<string>("medio");
  const [playedCategory, setPlayedCategory] = useState<string>("todas");
  const [playedDifficulty, setPlayedDifficulty] = useState<string>("medio");
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [points, setPoints] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [errorKind, setErrorKind] = useState<ErrorKind>("error");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    return () => abortRef.current?.abort();
  }, []);


  // Per-question countdown timer
  const questionSeconds = TIMER_PER_DIFFICULTY[playedDifficulty] ?? 20;
  const pointsPerCorrect = POINTS_PER_DIFFICULTY[playedDifficulty] ?? 20;

  useEffect(() => {
    if (phase !== "playing") return;
    setTimeLeft(questionSeconds);
  }, [phase, current, questionSeconds]);

  useEffect(() => {
    if (phase !== "playing" || selected !== null) return;
    if (timeLeft <= 0) {
      setSelected(TIMEOUT_SENTINEL);
      return;
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, selected, timeLeft]);

  async function startQuiz() {
    setPhase("loading");
    setErrorMessage("");
    setQuestions([]);
    setCurrent(0);
    setScore(0);
    setPoints(0);
    setSelected(null);
    setPlayedCategory(category);
    setPlayedDifficulty(difficulty);

    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const asked = loadAsked();

    try {
      const result = await Promise.race([
        gen({ data: { category, difficulty, exclude: asked.slice(-60) } }),
        new Promise<never>((_, rej) => {
          controller.signal.addEventListener("abort", () => rej(new Error("timeout")));
        }),
      ]);
      clearTimeout(timer);

      if (result.error || !result.results.length) {
        setErrorKind(result.results.length ? "error" : "empty");
        setErrorMessage(result.error || "Nenhuma pergunta foi gerada. Tente novamente.");
        setPhase("error");
        return;
      }

      const newTexts = result.results.map((q) => q.question);
      saveAsked([...asked, ...newTexts]);
      setQuestions(result.results);
      setPhase("playing");
    } catch (e) {
      clearTimeout(timer);
      const isTimeout = e instanceof Error && e.message === "timeout";
      setErrorKind(isTimeout ? "timeout" : "error");
      setErrorMessage(
        isTimeout
          ? "A IA demorou demais pra responder. Tente novamente."
          : "Erro ao gerar perguntas. Tente novamente em instantes.",
      );
      setPhase("error");
    }
  }

  function handleAnswer(a: string) {
    if (selected) return;
    setSelected(a);
    if (a === questions[current].correct) {
      setScore((s) => s + 1);
      setPoints((p) => p + pointsPerCorrect);
    }
  }

  function next() {
    setSelected(null);
    if (current + 1 >= questions.length) {
      setPhase("finished");
    } else {
      setCurrent((c) => c + 1);
    }
  }

  function backToSetup() {
    setPhase("setup");
    setQuestions([]);
    setCurrent(0);
    setScore(0);
    setPoints(0);
    setSelected(null);
  }

  const total = questions.length;
  const progress = total ? ((current + (selected ? 1 : 0)) / total) * 100 : 0;
  const timePct = questionSeconds ? (timeLeft / questionSeconds) * 100 : 0;
  const timedOut = selected === TIMEOUT_SENTINEL;
  const maxPoints = total * pointsPerCorrect;

  const catLabel = CATEGORIES.find((c) => c.id === playedCategory)?.label ?? playedCategory;
  const diffLabel = DIFFICULTIES.find((d) => d.id === playedDifficulty)?.label ?? playedDifficulty;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="max-w-4xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center btn-hero">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">Trivia de Games</span>
        </div>
      </header>


      <main className="flex-1 max-w-3xl mx-auto w-full px-6 pb-16">
        <div className="text-center mb-8 animate-fade-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full card-glow text-xs font-semibold text-muted-foreground mb-4">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Trivia de Videogames
          </div>
          <h1 className="text-4xl md:text-5xl font-bold">Quanto você <span className="text-gradient">manja de games?</span></h1>
          <p className="text-muted-foreground mt-3">Perguntas geradas por IA, personalizadas por categoria e dificuldade.</p>
        </div>

        {phase === "setup" && (
          <div className="animate-fade-up space-y-8">
            <div className="card-glow rounded-2xl p-6 md:p-8">
              <h2 className="text-lg font-bold mb-1">Escolha a categoria</h2>
              <p className="text-sm text-muted-foreground mb-5">Sobre o que vão ser as perguntas. Cada rodada tem {QUESTIONS_PER_ROUND} perguntas.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {CATEGORIES.map((c) => {
                  const Icon = c.icon;
                  const active = category === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setCategory(c.id)}
                      className={`chip flex-col !h-auto py-4 gap-1.5 text-center ${active ? "chip-active" : ""}`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-semibold text-sm leading-tight">{c.label}</span>
                      <span className="text-[10px] opacity-70">{c.hint}</span>
                      <span className="text-[10px] opacity-60">{QUESTIONS_PER_ROUND} perguntas</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="card-glow rounded-2xl p-6 md:p-8">
              <h2 className="text-lg font-bold mb-1">Escolha a dificuldade</h2>
              <p className="text-sm text-muted-foreground mb-5">Mais difícil = mais pontos e mais tempo por pergunta.</p>
              <div className="grid grid-cols-3 gap-3">
                {DIFFICULTIES.map((d) => {
                  const active = difficulty === d.id;
                  return (
                    <button
                      key={d.id}
                      onClick={() => setDifficulty(d.id)}
                      className={`chip flex-col !h-auto py-4 gap-1 ${active ? "chip-active" : ""}`}
                    >
                      <span className="font-semibold">{d.label}</span>
                      <span className="text-[10px] opacity-70">{d.hint}</span>
                      <span className="text-[10px] opacity-60 flex items-center gap-1">
                        <TimerIcon className="w-3 h-3" /> {TIMER_PER_DIFFICULTY[d.id]}s
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-center">
              <Button onClick={startQuiz} className="btn-hero h-14 px-8 rounded-full font-bold text-base">
                Começar quiz <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {phase === "loading" && (
          <div className="py-10 animate-fade-up">
            <div className="text-center mb-10">
              <div className="inline-flex w-14 h-14 rounded-full btn-hero items-center justify-center animate-pulse-glow mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <p className="text-muted-foreground">A IA está preparando suas perguntas...</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Isso pode levar alguns segundos.</p>
            </div>
            <div className="card-glow rounded-2xl p-6 md:p-8 space-y-6">
              <div className="space-y-3">
                <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                <div className="h-4 bg-muted rounded w-full animate-pulse" />
                <div className="h-4 bg-muted rounded w-5/6 animate-pulse" />
              </div>
              <div className="grid gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-full bg-muted animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="py-16 text-center animate-fade-up">
            <div className={`inline-flex w-14 h-14 rounded-full items-center justify-center mb-4 ${errorKind === "timeout" ? "bg-amber-400/10 text-amber-300" : "bg-rose-400/10 text-rose-300"}`}>
              {errorKind === "timeout" ? <AlertCircle className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
            </div>
            <h3 className="text-xl font-bold mb-2">
              {errorKind === "timeout" ? "A IA está demorando" : "Não foi possível carregar"}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">{errorMessage}</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button onClick={startQuiz} className="btn-hero rounded-full">Tentar novamente</Button>
              <Button onClick={backToSetup} variant="ghost">Mudar categoria</Button>
            </div>
          </div>
        )}

        {phase === "playing" && total > 0 && (
          <div className="animate-fade-up">
            <div className="mb-6 flex items-center justify-center gap-2 flex-wrap">
              <span className="chip !py-1.5 !px-3 text-xs">{catLabel}</span>
              <span className="chip !py-1.5 !px-3 text-xs">{diffLabel}</span>
              <span className="chip !py-1.5 !px-3 text-xs">
                <Trophy className="w-3.5 h-3.5" /> {points} pts
              </span>
            </div>
            <div className="mb-8">
              <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-2">
                <span>Pergunta {current + 1} de {total}</span>
                <span>Acertos: {score}</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>

            <div className="card-glow rounded-2xl p-6 md:p-8">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <TimerIcon className={`w-3.5 h-3.5 ${timeLeft <= 5 && !selected ? "text-rose-300" : "text-accent"}`} />
                  <span className={timeLeft <= 5 && !selected ? "text-rose-300" : ""}>
                    {selected ? "Tempo travado" : `${timeLeft}s`}
                  </span>
                </div>
                <span className="text-xs font-semibold text-muted-foreground">
                  Vale {pointsPerCorrect} pts
                </span>
              </div>
              <Progress value={timePct} className="h-1 mb-6" />

              <h2 className="text-2xl md:text-3xl font-bold mb-6 leading-tight">
                {questions[current].question}
              </h2>
              <div className="grid gap-3">
                {questions[current].answers.map((a) => {
                  const isCorrect = a === questions[current].correct;
                  const isPicked = selected === a;
                  const showState = selected !== null;
                  let cls = "chip w-full justify-start text-left";
                  if (showState && isCorrect) cls += " !border-emerald-400/60 !bg-emerald-400/10 !text-emerald-300";
                  else if (showState && isPicked && !isCorrect) cls += " !border-rose-400/60 !bg-rose-400/10 !text-rose-300";
                  else if (isPicked) cls += " chip-active";
                  return (
                    <button
                      key={a}
                      onClick={() => handleAnswer(a)}
                      disabled={selected !== null}
                      className={cls}
                    >
                      <span className="flex-1">{a}</span>
                      {showState && isCorrect && <Check className="w-4 h-4" />}
                      {showState && isPicked && !isCorrect && <X className="w-4 h-4" />}
                    </button>
                  );
                })}
              </div>

              {selected && (
                <>
                  {(() => {
                    const isRight = selected === questions[current].correct;
                    const tone = isRight
                      ? "border-emerald-400/40 bg-emerald-400/10"
                      : timedOut
                        ? "border-amber-400/40 bg-amber-400/10"
                        : "border-rose-400/40 bg-rose-400/10";
                    const iconTone = isRight
                      ? "bg-emerald-400/20 text-emerald-300"
                      : timedOut
                        ? "bg-amber-400/20 text-amber-300"
                        : "bg-rose-400/20 text-rose-300";
                    const titleTone = isRight
                      ? "text-emerald-300"
                      : timedOut
                        ? "text-amber-300"
                        : "text-rose-300";
                    return (
                      <div className={`mt-6 rounded-xl border p-4 flex gap-3 items-start ${tone}`} role="status" aria-live="polite">
                        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${iconTone}`}>
                          {isRight ? <Check className="w-4 h-4" /> : timedOut ? <TimerIcon className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        </div>
                        <div className="text-sm">
                          <p className={`font-bold mb-1 ${titleTone}`}>
                            {isRight ? `Correto! +${pointsPerCorrect} pts` : timedOut ? "Tempo esgotado." : "Errado."}
                          </p>
                          {!isRight && (
                            <p className="text-muted-foreground mb-1">
                              Resposta certa: <span className="font-semibold text-foreground">{questions[current].correct}</span>
                            </p>
                          )}
                          {questions[current].explanation && (
                            <p className="text-muted-foreground leading-relaxed">{questions[current].explanation}</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  <div className="flex justify-end mt-6">
                    <Button onClick={next} className="btn-hero h-12 px-6 rounded-full font-bold">
                      {current + 1 < total ? "Próxima" : "Ver resultado"} <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {phase === "finished" && (
          <div className="py-12 text-center animate-fade-up">
            <div className="inline-flex w-16 h-16 rounded-full btn-hero items-center justify-center mb-6">
              <Trophy className="w-7 h-7" />
            </div>
            <h2 className="text-4xl font-bold mb-2">Fim do quiz!</h2>
            <p className="text-lg text-muted-foreground mb-2">
              Você acertou <span className="text-gradient font-bold">{score}</span> de {total}
            </p>
            <p className="text-3xl font-bold mb-6">
              <span className="text-gradient">{points}</span>
              <span className="text-muted-foreground text-lg font-semibold"> / {maxPoints} pts</span>
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap mb-8">
              <span className="chip !py-1.5 !px-3 text-xs">Categoria: {catLabel}</span>
              <span className="chip !py-1.5 !px-3 text-xs">Dificuldade: {diffLabel}</span>
              <span className="chip !py-1.5 !px-3 text-xs">
                <Trophy className="w-3.5 h-3.5" /> {points} pts
              </span>
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button onClick={startQuiz} className="btn-hero rounded-full h-12 px-6 font-bold">
                <RotateCcw className="w-4 h-4 mr-2" /> Jogar de novo
              </Button>
              <Button onClick={backToSetup} variant="ghost" className="rounded-full h-12 px-6">
                Mudar categoria
              </Button>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}
