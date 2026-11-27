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
      { name: "description", content: "Acesso à plataforma Maxi Armazém." },
      { property: "og:title", content: "Entrar | Maxi Armazém" },
      { property: "og:description", content: "Acesso à plataforma Maxi Armazém." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.functions.invoke<{
      session?: { access_token: string; refresh_token: string };
      error?: string;
    }>("username-login", {
      body: { username: username.trim(), password },
    });

    if (error || !data?.session) {
      setBusy(false);
      toast.error(data?.error ?? "Nome de utilizador ou palavra-passe inválidos.");
      return;
    }

    const { error: sessionError } = await supabase.auth.setSession(data.session);
    setBusy(false);
    if (sessionError) {
      toast.error("Não foi possível iniciar a sessão. Tente novamente.");
      return;
    }
    navigate({ to: "/" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">Maxi Armazém</h1>
        <p className="text-sm text-muted-foreground">
          Entre com o seu nome de utilizador e palavra-passe.
        </p>
        <Input
          type="text"
          placeholder="Nome de utilizador"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
          maxLength={40}
        />
        <Input
          type="password"
          placeholder="Palavra-passe"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "A entrar…" : "Entrar"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          As contas são criadas pelo administrador do sistema.
        </p>
      </form>
    </main>
  );
}
