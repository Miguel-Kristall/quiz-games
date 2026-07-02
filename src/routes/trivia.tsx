import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Gamepad2, Sparkles, RotateCcw, ArrowRight, Trophy, ArrowLeft, Check, X, AlertCircle, WifiOff } from "lucide-react";

export const Route = createFileRoute("/trivia")({
  head: () => ({
    meta: [
      { title: "Trivia de Games — Qual Jogo Jogar?" },
      { name: "description", content: "Teste seus conhecimentos sobre videogames com 10 perguntas rápidas." },
      { property: "og:title", content: "Trivia de Games" },
      { property: "og:description", content: "Quiz de trivia sobre videogames." },
    ],
  }),
  component: TriviaPage,
});

const API_URL = "https://opentdb.com/api.php?amount=10&category=15&type=multiple";

function decodeHTML(str: string) {
  if (typeof document === "undefined") return str;
  const txt = document.createElement("textarea");
  txt.innerHTML = str;
  return txt.value;
}

type Q = { question: string; correct: string; answers: string[] };

type LoadingState = "idle" | "loading" | "timeout" | "error" | "empty";

async function fetchWithTimeout(url: string, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof DOMException && e.name === "AbortError") throw new Error("timeout");
    throw e;
  }
}

function TriviaPage() {
  const [questions, setQuestions] = useState<Q[]>([]);
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<LoadingState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setErrorMessage("");
    setQuestions([]);
    setCurrent(0);
    setScore(0);
    setSelected(null);

    fetchWithTimeout(API_URL, 10000)
      .then((data) => {
        if (cancelled) return;
        if (!data?.results?.length) {
          setStatus("empty");
          setErrorMessage("Nenhuma pergunta foi retornada. Tente recarregar.");
          return;
        }
        const formatted: Q[] = data.results.map((q: any) => {
          const answers = [...q.incorrect_answers, q.correct_answer]
            .map(decodeHTML)
            .sort(() => Math.random() - 0.5);
          return {
            question: decodeHTML(q.question),
            correct: decodeHTML(q.correct_answer),
            answers,
          };
        });
        setQuestions(formatted);
        setStatus("idle");
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err.message === "timeout"
          ? "A API do Open Trivia DB demorou demais para responder. Tente novamente."
          : err.message?.includes("fetch")
          ? "Não foi possível conectar à API do Open Trivia DB. Verifique sua internet."
          : "Erro ao buscar perguntas. Tente novamente em instantes.";
        setErrorMessage(message);
        setStatus(err.message === "timeout" ? "timeout" : "error");
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function handleAnswer(a: string) {
    if (selected) return;
    setSelected(a);
    if (a === questions[current].correct) setScore((s) => s + 1);
  }
  function next() {
    setSelected(null);
    setCurrent((c) => c + 1);
  }
  function restart() {
    setReloadKey((k) => k + 1);
  }

  const total = questions.length;
  const progress = total ? ((current + (selected ? 1 : 0)) / total) * 100 : 0;
  const finished = !loading && total > 0 && current >= total;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="max-w-4xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center btn-hero">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">Qual Jogo Jogar?</span>
        </Link>
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link to="/"><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</Link>
        </Button>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 pb-16">
        <div className="text-center mb-8 animate-fade-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full card-glow text-xs font-semibold text-muted-foreground mb-4">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Trivia de Videogames
          </div>
          <h1 className="text-4xl md:text-5xl font-bold">Quanto você <span className="text-gradient">manja de games?</span></h1>
          <p className="text-muted-foreground mt-3">10 perguntas do Open Trivia DB, categoria Video Games.</p>
        </div>

        {loading && (
          <div className="py-20 text-center animate-fade-up">
            <div className="inline-flex w-14 h-14 rounded-full btn-hero items-center justify-center animate-pulse-glow mb-4">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-muted-foreground">Carregando perguntas...</p>
          </div>
        )}

        {!loading && error && (
          <div className="py-16 text-center animate-fade-up">
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={restart} className="btn-hero rounded-full">Tentar novamente</Button>
          </div>
        )}

        {!loading && !error && !finished && total > 0 && (
          <div className="animate-fade-up">
            <div className="mb-8">
              <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-2">
                <span>Pergunta {current + 1} de {total}</span>
                <span>Acertos: {score}</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>

            <div className="card-glow rounded-2xl p-6 md:p-8">
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
                <div className="flex justify-end mt-8">
                  <Button onClick={next} className="btn-hero h-12 px-6 rounded-full font-bold">
                    {current + 1 < total ? "Próxima" : "Ver resultado"} <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {finished && (
          <div className="py-12 text-center animate-fade-up">
            <div className="inline-flex w-16 h-16 rounded-full btn-hero items-center justify-center mb-6">
              <Trophy className="w-7 h-7" />
            </div>
            <h2 className="text-4xl font-bold mb-2">Fim do quiz!</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Você acertou <span className="text-gradient font-bold">{score}</span> de {total}
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button onClick={restart} className="btn-hero rounded-full h-12 px-6 font-bold">
                <RotateCcw className="w-4 h-4 mr-2" /> Jogar de novo
              </Button>
              <Button asChild variant="ghost">
                <Link to="/">Ver recomendações</Link>
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
