import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar | Maxi Armazém" },
      { name: "description", content: "Acesso da equipa Maxi Armazém às vistorias." },
      { property: "og:title", content: "Entrar | Maxi Armazém" },
      { property: "og:description", content: "Acesso da equipa Maxi Armazém às vistorias." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { username: username.trim(), display_name: username.trim() },
              emailRedirectTo: window.location.origin,
            },
          });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (mode === "up") {
      toast.success("Conta criada. Confirme o seu email para entrar.");
      return;
    }
    navigate({ to: "/" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">Maxi Armazém</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "in" ? "Entre para aceder às vistorias." : "Crie a sua conta da equipa."}
        </p>
        {mode === "up" ? <Input type="text" placeholder="Nome de utilizador" value={username} onChange={(e) => setUsername(e.target.value)} required maxLength={40} /> : null}
        <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input type="password" placeholder="Palavra-passe" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit" className="w-full" disabled={busy}>
          {mode === "in" ? "Entrar" : "Criar conta"}
        </Button>
        <button type="button" className="w-full text-sm text-muted-foreground underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
        </button>
      </form>
    </main>
  );
}
