import { useEffect, useState } from "react";
import { ArrowRight, BarChart3, Eye, EyeOff, Info, LockKeyhole, MapPinned, Package, UserRound } from "lucide-react";
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
      { title: "Entrar | NESPECTION" },
      { name: "description", content: "Acesso ao sistema NESPECTION." },
      { property: "og:title", content: "Entrar | NESPECTION" },
      { property: "og:description", content: "Acesso à plataforma NESPECTION." },
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
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let active = true;
    void getStatus().then((data) => {
      if (!active) return;
      const available = canCreateFirstAdmin(data.adminCount);
      setSetupAvailable(available);
      if (available) setMode("setup");
    }).catch(() => { /* Fail closed on an unavailable administrator count. */ });
    return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#eaf8f2] px-4 py-8 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-[48%] h-72 w-72 rounded-full bg-[#bcebd7]/50 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 h-96 w-96 rounded-full bg-[#c7f2df]/70 blur-3xl" />
      <div className="relative grid w-full max-w-[1260px] overflow-hidden rounded-[26px] bg-[#003d2b] shadow-[0_28px_80px_rgba(0,77,51,0.22)] lg:min-h-[675px] lg:grid-cols-[1.02fr_0.98fr]">
        <section className="flex flex-col justify-center bg-gradient-to-br from-[#003d2b] via-[#003626] to-[#002d22] px-7 py-10 text-white sm:px-12 sm:py-12 lg:px-[clamp(40px,6vw,90px)]">
          <div className="mb-10 flex items-center gap-4 sm:mb-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#28e47b] to-[#00a85a] shadow-lg shadow-emerald-950/30">
              <Package className="h-9 w-9 text-[#003d2b]" strokeWidth={2.4} />
            </div>
            <div className="h-12 w-px bg-white/25" />
            <span className="text-[25px] font-extrabold leading-[1.05] tracking-wide sm:text-[29px]">NESPECTION</span>
          </div>
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight sm:text-[40px]">{isSetup ? "Configurar acesso" : "Acesso ao sistema"}</h1>
            <p className="mt-2 max-w-md text-base text-emerald-50/75 sm:text-lg">
              {isSetup ? "Crie a primeira conta de administrador para começar." : "Entre com o seu utilizador e palavra-passe."}
            </p>
          </div>
          <form onSubmit={submit} className="w-full max-w-[500px] space-y-5">
            <label className="flex h-[66px] items-center gap-4 rounded-2xl border border-emerald-200/35 bg-white/[0.045] px-5 transition focus-within:border-emerald-300 focus-within:bg-white/[0.08]">
              <UserRound className="h-6 w-6 shrink-0 text-emerald-100/75" />
              <Input type="text" placeholder="Nome de utilizador" aria-label="Nome de utilizador" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,39}" title="Use letras, números, ponto, hífen ou underscore." className="h-full border-0 bg-transparent px-0 text-base text-white shadow-none placeholder:text-emerald-50/65 focus-visible:ring-0" />
            </label>
            <label className="flex h-[66px] items-center gap-4 rounded-2xl border border-emerald-200/35 bg-white/[0.045] px-5 transition focus-within:border-emerald-300 focus-within:bg-white/[0.08]">
              <LockKeyhole className="h-6 w-6 shrink-0 text-emerald-100/75" />
              <Input type={showPassword ? "text" : "password"} placeholder="Palavra-passe" aria-label="Palavra-passe" autoComplete={isSetup ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={isSetup ? 8 : undefined} className="h-full border-0 bg-transparent px-0 text-base text-white shadow-none placeholder:text-emerald-50/65 focus-visible:ring-0" />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"} className="shrink-0 text-emerald-50/80 transition hover:text-white">
                {showPassword ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
              </button>
            </label>
            {isSetup && <Input type="password" placeholder="Confirmar palavra-passe" aria-label="Confirmar palavra-passe" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} className="h-[62px] rounded-2xl border-emerald-200/35 bg-white/[0.045] px-5 text-white placeholder:text-emerald-50/65" />}
            <Button type="submit" disabled={busy} className="h-[66px] w-full rounded-2xl bg-gradient-to-r from-[#20cf70] to-[#00a957] text-lg font-bold text-white shadow-lg shadow-emerald-950/25 transition hover:brightness-110">
              {busy ? (isSetup ? "A criar administrador…" : "A entrar…") : (isSetup ? "Criar administrador e entrar" : "Entrar")}
              {!busy && <ArrowRight className="ml-2 h-6 w-6" />}
            </Button>
            {setupAvailable && <Button type="button" variant="ghost" className="w-full text-emerald-100 hover:bg-white/10 hover:text-white" onClick={() => setMode(isSetup ? "login" : "setup")}>{isSetup ? "Já tenho uma conta" : "Criar primeiro administrador"}</Button>}
          </form>
          <p className="mt-8 flex items-center gap-2 text-sm text-emerald-50/75">
            <Info className="h-5 w-5 shrink-0" />
            {isSetup ? "Esta opção fica indisponível depois de criar o primeiro administrador." : "As contas são criadas pelo administrador do sistema."}
          </p>
        </section>
        <aside className="relative hidden min-h-[675px] overflow-hidden lg:flex lg:flex-col lg:justify-center lg:px-14 xl:px-16">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1600&q=85')" }} />
          <div className="absolute inset-0 bg-gradient-to-br from-[#002d21]/95 via-[#003d2b]/80 to-[#001f18]/65" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_85%,rgba(0,214,111,0.24),transparent_38%)]" />
          <div className="relative z-10 max-w-lg">
            <h2 className="text-[38px] font-bold leading-tight tracking-tight">Gestão de<span className="block text-[#39e783]">Encomendas e Rotas</span></h2>
            <div className="mt-10 space-y-4">
              {[
                { icon: Package, label: "Controlo de encomendas" },
                { icon: MapPinned, label: "Planeamento de rotas" },
                { icon: BarChart3, label: "Histórico e relatórios" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-5">
                  <div className="flex h-[58px] w-[58px] items-center justify-center rounded-2xl border border-[#5be99b]/70 bg-emerald-950/35 text-[#75f0ad] shadow-[0_0_22px_rgba(26,211,116,0.12)]"><Icon className="h-8 w-8" strokeWidth={1.8} /></div>
                  <span className="text-lg font-medium text-white">{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div aria-hidden="true" className="absolute -bottom-20 -right-16 h-64 w-64 rotate-12 rounded-[42px] border-[22px] border-[#19d875]/45" />
        </aside>
      </div>
    </main>
  );
}
