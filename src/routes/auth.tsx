import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { canCreateFirstAdmin } from "@/lib/first-admin";
import { useServerFn } from "@tanstack/react-start";
import { loginStatus, usernameLogin } from "@/lib/username-login.functions";
import { INVALID_CREDENTIALS, loginCredentialsSchema, setupCredentialsSchema } from "@/lib/login-credentials";

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
  const login = useServerFn(usernameLogin);
  const getStatus = useServerFn(loginStatus);
  const [mode, setMode] = useState<AuthMode>("login");
  const [setupAvailable, setSetupAvailable] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void getStatus().then((data) => {
      if (!active) return;
      const available = canCreateFirstAdmin(data.adminCount);
      setSetupAvailable(available);
      if (available) setMode("setup");
    }).catch(() => { /* Fail closed on an unavailable administrator count. */ });
    return () => {
      active = false;
    };
  }, [getStatus]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "setup" && password !== confirmPassword) {
      toast.error("As palavras-passe não coincidem.");
      return;
    }

    const schema = mode === "setup" ? setupCredentialsSchema : loginCredentialsSchema;
    if (!schema.safeParse({ username, password }).success) {
      toast.error(INVALID_CREDENTIALS);
      return;
    }
    setBusy(true);
    try {
      const data = await login({ data: {
        action: mode === "setup" ? "bootstrap" : "login", username, password,
      } });
      if (!("session" in data)) {
        toast.error(INVALID_CREDENTIALS);
        return;
      }
      const { error: sessionError } = await supabase.auth.setSession(data.session);
      if (sessionError) {
        toast.error("Não foi possível iniciar a sessão. Tente novamente.");
        return;
      }
      setPassword("");
      setConfirmPassword("");
      if (mode === "setup") toast.success("Primeiro administrador criado com sucesso.");
      await navigate({ to: "/" });
    } catch {
      toast.error(INVALID_CREDENTIALS);
    } finally {
      setBusy(false);
    }
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
          aria-label="Nome de utilizador"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
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
          aria-label="Palavra-passe"
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
            aria-label="Confirmar palavra-passe"
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
