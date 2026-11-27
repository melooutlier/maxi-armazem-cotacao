import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Bem-vindo | NESPECTIONA" },
      { name: "description", content: "Bem-vindo ao NESPECTIONA, sistema de gestão de operações." },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-5 py-12 text-white">
      <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-teal-400/10 blur-3xl" />
      <section className="relative z-10 mx-auto w-full max-w-3xl text-center">
        <div className="mx-auto mb-8 grid h-20 w-20 place-items-center rounded-3xl border border-emerald-300/30 bg-emerald-400/10 text-3xl font-black tracking-tight text-emerald-300 shadow-2xl shadow-emerald-950/40">N</div>
        <p className="text-sm font-semibold uppercase tracking-[.35em] text-emerald-300">Bem-vindo ao</p>
        <h1 className="mt-4 text-5xl font-bold tracking-tight sm:text-7xl">NESPECTIONA</h1>
        <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
          A plataforma de gestão de encomendas, empresas e rotas. Organize as operações da sua equipa num único lugar.
        </p>
        <Link to="/auth" className="mt-10 inline-flex min-w-44 items-center justify-center rounded-xl bg-emerald-500 px-8 py-3.5 text-base font-bold text-slate-950 shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-400">
          Entrar no sistema <span aria-hidden="true" className="ml-2">→</span>
        </Link>
        <p className="mt-12 text-xs tracking-wide text-slate-500">NESPECTIONA · Gestão e organização</p>
      </section>
    </main>
  );
}
