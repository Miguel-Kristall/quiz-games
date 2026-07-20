import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gamepad2, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Entrar — Trivia de Games" },
      { name: "description", content: "Faça login ou crie sua conta para jogar o quiz de trivia de videogames." },
      { property: "og:title", content: "Entrar — Trivia de Games" },
      { property: "og:description", content: "Faça login ou crie sua conta para jogar o quiz." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("E-mail inválido").max(255);
const passwordSchema = z.string().min(6, "A senha precisa ter pelo menos 6 caracteres").max(72);
const nameSchema = z.string().trim().min(1, "Digite seu nome").max(80);

function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid_credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("already registered") || m.includes("already been registered") || m.includes("user already")) return "Este e-mail já está cadastrado. Faça login.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (m.includes("rate limit")) return "Muitas tentativas. Aguarde alguns instantes.";
  if (m.includes("password")) return "Senha inválida. Use pelo menos 6 caracteres.";
  return msg || "Algo deu errado. Tente novamente.";
}

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: (search.redirect as any) || "/trivia", replace: true });
      } else {
        setChecking(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: (search.redirect as any) || "/trivia", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, search.redirect]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const emailRes = emailSchema.safeParse(email);
    if (!emailRes.success) return setError(emailRes.error.issues[0].message);
    const pwRes = passwordSchema.safeParse(password);
    if (!pwRes.success) return setError(pwRes.error.issues[0].message);

    if (mode === "signup") {
      const nameRes = nameSchema.safeParse(name);
      if (!nameRes.success) return setError(nameRes.error.issues[0].message);
    }

    setSubmitting(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailRes.data,
          password: pwRes.data,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: emailRes.data,
          password: pwRes.data,
          options: {
            data: { name: name.trim() },
            emailRedirectTo: `${window.location.origin}/trivia`,
          },
        });
        if (error) throw error;
      }
    } catch (err) {
      setError(friendlyError((err as Error).message));
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <Link to="/" className="flex items-center gap-2 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center btn-hero">
          <Gamepad2 className="w-5 h-5" />
        </div>
        <span className="font-display font-bold text-xl tracking-tight">Trivia de Games</span>
      </Link>

      <div className="card-glow rounded-2xl p-6 md:p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-1">
          {mode === "signin" ? "Entrar" : "Criar conta"}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "signin"
            ? "Entre para continuar jogando."
            : "Crie sua conta para salvar seus recordes."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                required
                maxLength={80}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              required
              maxLength={255}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
              maxLength={72}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-400/40 bg-rose-400/10 p-3 flex gap-2 items-start text-sm text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" disabled={submitting} className="btn-hero w-full h-12 rounded-full font-bold">
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Aguarde...</>
            ) : mode === "signin" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? (
            <>
              Não tem conta?{" "}
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(null); }}
                className="text-primary hover:text-accent font-semibold"
              >
                Criar conta
              </button>
            </>
          ) : (
            <>
              Já tem conta?{" "}
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(null); }}
                className="text-primary hover:text-accent font-semibold"
              >
                Fazer login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
