import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { canCreateFirstAdmin } from "@/lib/first-admin";

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

type AuthMode = "login" | "setup";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [setupAvailable, setSetupAvailable] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.functions.invoke<{ adminCount?: number }>("username-login", {
      body: { action: "status" },
    }).then(({ data, error }) => {
      if (!active || error) return;
      const available = canCreateFirstAdmin(data?.adminCount);
      setSetupAvailable(available);
      if (available) setMode("setup");
    });
    return () => {
      active = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "setup" && password !== confirmPassword) {
      toast.error("As palavras-passe não coincidem.");
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.functions.invoke<{
      session?: { access_token: string; refresh_token: string };
      error?: string;
    }>("username-login", {
      body: {
        action: mode === "setup" ? "bootstrap" : "login",
        username: username.trim(),
        password,
      },
    });

    if (error || !data?.session) {
      setBusy(false);
      toast.error(data?.error ?? (mode === "setup"
        ? "Não foi possível criar o primeiro administrador. Verifique os dados e tente novamente."
        : "Nome de utilizador ou palavra-passe inválidos."));
      return;
    }

    const { error: sessionError } = await supabase.auth.setSession(data.session);
    setBusy(false);
    if (sessionError) {
      toast.error("Não foi possível iniciar a sessão. Tente novamente.");
      return;
    }
    if (mode === "setup") toast.success("Primeiro administrador criado com sucesso.");
    navigate({ to: "/" });
  }

  const isSetup = mode === "setup";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Maxi Armazém</h1>
          <p className="text-sm text-muted-foreground">
            {isSetup
              ? "Crie a primeira conta de administrador para começar a gerir o sistema."
              : "Entre com o seu nome de utilizador e palavra-passe."}
          </p>
        </div>
        <Input
          type="text"
          placeholder="Nome de utilizador"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
          maxLength={40}
          pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,39}"
          title="Use letras, números, ponto, hífen ou underscore."
        />
        <Input
          type="password"
          placeholder="Palavra-passe"
          autoComplete={isSetup ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={isSetup ? 8 : undefined}
        />
        {isSetup && (
          <Input
            type="password"
            placeholder="Confirmar palavra-passe"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy
            ? isSetup ? "A criar administrador…" : "A entrar…"
            : isSetup ? "Criar administrador e entrar" : "Entrar"}
        </Button>
        {setupAvailable && (
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setMode(isSetup ? "login" : "setup")}
          >
            {isSetup ? "Já tenho uma conta" : "Criar primeiro administrador"}
          </Button>
        )}
        <p className="text-center text-xs text-muted-foreground">
          {isSetup
            ? "Esta opção fica indisponível depois de criar o primeiro administrador."
            : "As contas são criadas pelo administrador do sistema."}
        </p>
      </form>
    </main>
  );
}
