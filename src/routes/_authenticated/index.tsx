import { useMemo, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Boxes,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Copy,
  Download,
  History,
  MapPin,
  Minus,
  Package,
  Plus,
  Printer,
  Search,
  Store,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BOX_STEP,
  PRIORITIES,
  PRODUCT_CATALOG,
  QUANTITY_PRESETS,
  SUPERMARKETS,
  addQuantity,
  canCompleteVisit,
  durationInMinutes,
  fieldVisitQueryOptions,
  formatDateTime,
  formatDuration,
  localDateValue,
  type CatalogProduct,
  type Priority,
  type Visit,
  type VisitItem,
} from "@/lib/field-visits";
import { supabase } from "@/integrations/supabase/client";

type ViewMode = "menu" | "field" | "office" | "history";

export const Route = createFileRoute("/_authenticated/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(fieldVisitQueryOptions),
  head: () => ({
    meta: [
      { title: "Maxi Armazém | Vistoria e reposição" },
      {
        name: "description",
        content: "Registe faltas nas lojas, encaminhe reposições e acompanhe vistorias da Maxi Armazém.",
      },
      { property: "og:title", content: "Maxi Armazém | Vistoria e reposição" },
      {
        property: "og:description",
        content: "Operação de campo, lançamento no escritório e histórico de reposições em Maputo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const MODES: { id: ViewMode; label: string; icon: typeof MapPin }[] = [
  { id: "field", label: "Campo", icon: MapPin },
  { id: "office", label: "Escritório", icon: ClipboardList },
  { id: "history", label: "Histórico", icon: History },
];

const priorityStyles: Record<Priority, string> = {
  Urgente: "border-destructive/20 bg-destructive/10 text-destructive",
  Normal: "border-border bg-secondary text-secondary-foreground",
  Baixa: "border-success/20 bg-success/10 text-success",
};

function Index() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(fieldVisitQueryOptions);
  const [mode, setMode] = useState<ViewMode>("menu");
  const [fieldStarted, setFieldStarted] = useState(false);
  const [completionChoiceOpen, setCompletionChoiceOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string>("VIP Spar Sommerschield");
  const [operatorName, setOperatorName] = useState("Utilizador autenticado");
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [officeVisitId, setOfficeVisitId] = useState("");
  const [historyStore, setHistoryStore] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchText, setSearchText] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [quantityText, setQuantityText] = useState("1");
  const [priority, setPriority] = useState<Priority>("Normal");
  const [clock, setClock] = useState<Date | null>(null);

  useEffect(() => {
    setClock(new Date());
    let mounted = true;
    void supabase.auth.getUser().then(({ data: authData }) => {
      if (!mounted) return;
      const user = authData.user;
      const metadataName =
        user?.user_metadata?.full_name ??
        user?.user_metadata?.name ??
        user?.user_metadata?.display_name;
      setOperatorName(
        typeof metadataName === "string" && metadataName.trim()
          ? metadataName.trim()
          : user?.email ?? "Utilizador autenticado",
      );
    });
    const timer = window.setInterval(() => setClock(new Date()), 60_000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const refreshVisits = () =>
    queryClient.invalidateQueries({ queryKey: fieldVisitQueryOptions.queryKey });

  const activeVisit =
    data.visits.find(
      (visit) =>
        visit.status === "in_progress" &&
        ((selectedVisitId !== null && visit.id === selectedVisitId) ||
          (visit.supermarket === selectedStore && visit.operator_name === operatorName.trim())),
    ) ?? null;
  const activeItems = activeVisit
    ? data.items.filter((item) => item.visit_id === activeVisit.id)
    : [];

  const startVisitMutation = useMutation({
    mutationFn: async ({ supermarket, operator }: { supermarket: string; operator: string }) => {
      const { data: visit, error } = await supabase
        .from("visits")
        .insert({ supermarket, operator_name: operator, status: "in_progress" })
        .select()
        .single();
      if (error) throw error;
      return visit;
    },
    onSuccess: async (visit) => {
      setSelectedVisitId(visit.id);
      setFieldStarted(true);
      await refreshVisits();
      toast.success("Vistoria iniciada.");
    },
    onError: (error) => toast.error(`Não foi possível iniciar a vistoria: ${error.message}`),
  });

  const addItemMutation = useMutation({
    mutationFn: async (input: {
      visitId: string;
      product: CatalogProduct;
      quantity: number;
      priority: Priority;
    }) => {
      const existing = data.items.find(
        (item) => item.visit_id === input.visitId && item.product_code === input.product.code,
      );
      const result = existing
        ? await supabase
            .from("visit_items")
            .update({ quantity: addQuantity(existing.quantity, input.quantity), priority: input.priority })
            .eq("id", existing.id)
        : await supabase.from("visit_items").insert({
            visit_id: input.visitId,
            product_code: input.product.code,
            product_name: input.product.name,
            category: input.product.category,
            unit: input.product.unit,
            quantity: input.quantity,
            priority: input.priority,
          });
      if (result.error) throw result.error;
    },
    onSuccess: async () => {
      await refreshVisits();
      setSearchText("");
      setSelectedProduct(null);
      setQuantityText("1");
      toast.success("Produto adicionado à vistoria.");
    },
    onError: (error) => toast.error(`Não foi possível adicionar o produto: ${error.message}`),
  });

  const quantityMutation = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      const { error } = await supabase.from("visit_items").update({ quantity }).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: refreshVisits,
    onError: (error) => toast.error(`Não foi possível alterar a quantidade: ${error.message}`),
  });

  const removeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("visit_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshVisits();
      toast.success("Produto removido da lista.");
    },
    onError: (error) => toast.error(`Não foi possível remover o produto: ${error.message}`),
  });

  const completeVisitMutation = useMutation({
    mutationFn: async (visitId: string) => {
      const { data: visit, error } = await supabase
        .from("visits")
        .update({ status: "completed" })
        .eq("id", visitId)
        .select()
        .single();
      if (error) throw error;
      return visit;
    },
    onSuccess: async (visit) => {
      setSelectedVisitId(null);
      setOfficeVisitId(visit.id);
      await refreshVisits();
      setCompletionChoiceOpen(true);
      toast.success(`Vistoria ${visit.visit_code ?? "concluída"} concluída.`);
    },
    onError: (error) => toast.error(`Não foi possível concluir a vistoria: ${error.message}`),
  });

  const launchItemMutation = useMutation({
    mutationFn: async ({ item, launched }: { item: VisitItem; launched: boolean }) => {
      const { error } = await supabase
        .from("visit_items")
        .update({ launched })
        .eq("id", item.id);
      if (error) throw error;

      const visitItems = data.items.filter((visitItem) => visitItem.visit_id === item.visit_id);
      const allLaunched =
        visitItems.length > 0 &&
        visitItems.every((visitItem) =>
          visitItem.id === item.id ? launched : visitItem.launched,
        );
      const visit = data.visits.find((entry) => entry.id === item.visit_id);
      if (allLaunched || (!launched && visit?.status === "launched")) {
        const { error: visitError } = await supabase
          .from("visits")
          .update({ status: allLaunched ? "launched" : "completed" })
          .eq("id", item.visit_id);
        if (visitError) throw visitError;
      }
    },
    onSuccess: refreshVisits,
    onError: (error) => toast.error(`Não foi possível atualizar o lançamento: ${error.message}`),
  });

  const suggestions = useMemo(() => {
    const search = searchText.trim().toLocaleLowerCase("pt-MZ");
    if (search.length === 0 || selectedProduct) return [];
    return PRODUCT_CATALOG.filter((product) =>
      `${product.code} ${product.name} ${product.category}`.toLocaleLowerCase("pt-MZ").includes(search),
    ).slice(0, 6);
  }, [searchText, selectedProduct]);

  const officeVisits = data.visits.filter((visit) => visit.status !== "in_progress");
  const officeVisit =
    officeVisits.find((visit) => visit.id === officeVisitId) ?? officeVisits[0] ?? null;
  const officeItems = officeVisit
    ? data.items.filter((item) => item.visit_id === officeVisit.id)
    : [];

  const historyVisits = data.visits.filter((visit) => {
    const visitDay = localDateValue(visit.started_at);
    const matchesStore = historyStore === "all" || visit.supermarket === historyStore;
    const matchesFrom = dateFrom.length === 0 || visitDay >= dateFrom;
    const matchesTo = dateTo.length === 0 || visitDay <= dateTo;
    return matchesStore && matchesFrom && matchesTo;
  });

  const completedVisits = data.visits.filter(
    (visit) => visit.status !== "in_progress" && visit.completed_at !== null,
  );
  const completedDurations = completedVisits
    .map((visit) => durationInMinutes(visit.started_at, visit.completed_at))
    .filter((minutes): minutes is number => minutes !== null);
  const averageDuration =
    completedDurations.length > 0
      ? Math.round(completedDurations.reduce((total, minutes) => total + minutes, 0) / completedDurations.length)
      : null;
  const pendingStores = new Set(
    data.visits
      .filter(
        (visit) =>
          visit.status === "completed" &&
          data.items.some((item) => item.visit_id === visit.id && !item.launched),
      )
      .map((visit) => visit.supermarket),
  );

  const handleStartVisit = () => {
    const operator = operatorName.trim();
    if (!operator) {
      toast.error("Informe o nome do gestor responsável.");
      return;
    }
    startVisitMutation.mutate({ supermarket: selectedStore, operator });
  };

  const handleAddItem = () => {
    if (!activeVisit) {
      toast.error("Inicie uma vistoria antes de adicionar produtos.");
      return;
    }
    if (!selectedProduct) {
      toast.error("Escolha um produto do catálogo.");
      return;
    }
    const quantity = Number(quantityText);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Informe uma quantidade maior que zero.");
      return;
    }
    addItemMutation.mutate({ visitId: activeVisit.id, product: selectedProduct, quantity, priority });
  };

  const handleCopy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message);
    } catch {
      toast.error("Não foi possível copiar. Verifique as permissões do navegador.");
    }
  };

  const handleCopyAll = () => {
    if (!officeVisit) return;
    const lines = [
      ["Código do produto", "Nome/descrição", "Quantidade em falta", "Prioridade"].join("\t"),
      ...officeItems.map((item) =>
        [item.product_code, item.product_name, item.quantity, item.priority].join("\t"),
      ),
    ];
    void handleCopy(lines.join("\n"), "Lista copiada para o lançamento.");
  };

  const handleExportCsv = () => {
    if (!officeVisit) return;
    const quote = (value: string | number | boolean) => `"${String(value).replaceAll('"', '""')}"`;
    const lines = [
      [
        "Código da vistoria",
        "Supermercado",
        "Código do produto",
        "Produto",
        "Quantidade em falta",
        "Unidade",
        "Prioridade",
        "Lançado no ERP",
      ].map(quote),
      ...officeItems.map((item) =>
        [
          officeVisit.visit_code ?? "",
          officeVisit.supermarket,
          item.product_code,
          item.product_name,
          item.quantity,
          item.unit,
          item.priority,
          item.launched ? "Sim" : "Não",
        ].map(quote),
      ),
    ];
    const csv = `\uFEFF${lines.map((line) => line.join(";")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${officeVisit.visit_code ?? "vistoria"}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Ficheiro CSV exportado.");
  };

  const initials =
    operatorName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "MA";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="no-print border-b border-brand-navy/15 bg-brand-navy text-brand-navy-foreground">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center justify-between gap-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-brand-green text-brand-green-foreground">
                <Boxes className="size-6" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-lg font-semibold leading-tight">Maxi Armazém</p>
                <p className="text-xs text-brand-navy-foreground/70">Operação de reposição · Maputo</p>
              </div>
            </div>
            <div className="flex items-center gap-2 lg:hidden">
              <span className="grid size-9 place-items-center rounded-full bg-brand-navy-foreground/10 text-xs font-semibold">
                {initials}
              </span>
            </div>
          </div>

          {mode !== "menu" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setMode("menu")}
              className="border-brand-navy-foreground/30 bg-brand-navy-foreground/10 text-brand-navy-foreground hover:bg-brand-navy-foreground/20"
            >
              <ArrowRight className="rotate-180" aria-hidden="true" />
              Menu inicial
            </Button>
          ) : null}

          <div className="hidden items-center gap-3 lg:flex">
            <div className="text-right">
              <p className="text-sm font-medium">{operatorName.trim() || "Utilizador autenticado"}</p>
              <p className="text-xs text-brand-navy-foreground/70">
                {clock
                  ? new Intl.DateTimeFormat("pt-MZ", {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(clock)
                  : "Hora local"}
              </p>
            </div>
            <span className="grid size-10 place-items-center rounded-full bg-brand-navy-foreground/10 text-sm font-semibold">
              {initials}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pt-9">
        <div className="no-print mb-7 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase text-success">
              <span className="size-2 rounded-full bg-success" />
              Sistema de gestão flexível
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
              {mode === "menu" ? "Área de trabalho" : mode === "field" ? "Vistoria em campo" : mode === "office" ? "Lançamento no escritório" : "Histórico & relatórios"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {mode === "menu"
                ? "Escolha a área em que pretende trabalhar."
                : mode === "field"
                  ? (fieldStarted || activeVisit ? "Pesquise os produtos no catálogo e registe as faltas da empresa." : "Escolha a empresa para iniciar uma nova vistoria.")
                  : mode === "office"
                    ? "Transfira os pedidos para o sistema central e acompanhe cada lançamento."
                    : "Acompanhe o ritmo das vistorias e as reposições pendentes."}
            </p>
          </div>
          {mode === "field" && activeVisit ? (
            <Badge className="w-fit border-success/20 bg-success/10 px-3 py-1.5 text-success">
              <Activity className="mr-1.5 size-3.5" aria-hidden="true" />
              Vistoria em andamento
            </Badge>
          ) : null}
        </div>

        {mode === "menu" ? (
          <section className="mx-auto grid max-w-5xl gap-5 py-8 md:grid-cols-3">
            {MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => { setMode(id); if (id === "field") setFieldStarted(false); }}
                className="group flex min-h-56 flex-col items-start justify-between rounded-xl border border-border bg-card p-7 text-left shadow-sm transition hover:-translate-y-1 hover:border-brand-green hover:shadow-md"
              >
                <span className="grid size-14 place-items-center rounded-xl bg-brand-green/15 text-brand-navy">
                  <Icon className="size-7" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-display text-2xl font-semibold">{label}</span>
                  <span className="mt-2 block text-sm text-muted-foreground">
                    {id === "field" ? "Iniciar e registar uma vistoria nas lojas." : id === "office" ? "Consultar listas e preparar lançamentos." : "Consultar vistorias e indicadores anteriores."}
                  </span>
                </span>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-navy">
                  Aceder <ArrowRight className="size-4" aria-hidden="true" />
                </span>
              </button>
            ))}
          </section>
        ) : null}

        {mode === "field" ? (
          <section className="space-y-6">
            {!fieldStarted && !activeVisit ? (
              <section className="grid min-h-[52vh] place-items-center py-8">
                <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8">
                  <div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-brand-green/15 text-brand-navy">
                    <Store className="size-7" aria-hidden="true" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-success">Vistoria de campo</p>
                    <h2 className="mt-2 font-display text-2xl font-semibold">Escolher empresa</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Seleccione a empresa onde pretende realizar a vistoria. Depois de iniciar, poderá pesquisar produtos e registar as faltas.</p>
                  </div>
                  <label className="mt-7 grid gap-2 text-sm font-medium">
                    Empresa
                    <Select value={selectedStore} onValueChange={setSelectedStore}>
                      <SelectTrigger className="h-12 bg-background text-left">
                        <SelectValue placeholder="Escolha a empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPERMARKETS.map((store) => (
                          <SelectItem key={store} value={store}>{store}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarDays className="size-4" aria-hidden="true" />
                    {clock
                      ? new Intl.DateTimeFormat("pt-MZ", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(clock)
                      : "Data e hora automáticas"}
                  </div>
                  <Button
                    type="button"
                    size="lg"
                    disabled={!selectedStore || startVisitMutation.isPending}
                    onClick={handleStartVisit}
                    className="mt-7 h-12 w-full bg-brand-green text-brand-green-foreground hover:bg-brand-green/90"
                  >
                    {startVisitMutation.isPending ? "A iniciar vistoria…" : "Iniciar vistoria"}
                    <ArrowRight aria-hidden="true" />
                  </Button>
                </div>
              </section>
            ) : null}

            {fieldStarted || activeVisit ? (
              <section className="space-y-6">
                <div className="min-w-0 rounded-md border border-border bg-card p-4 shadow-sm sm:p-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">02 · Encontrar produto</p>
                    <h2 className="mt-1 font-display text-xl font-semibold">Busca no catálogo</h2>
                  </div>
                  <span className="text-xs text-muted-foreground">{PRODUCT_CATALOG.length} produtos</span>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    value={searchText}
                    onChange={(event) => {
                      setSearchText(event.target.value);
                      setSelectedProduct(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && suggestions[0]) {
                        event.preventDefault();
                        setSelectedProduct(suggestions[0]);
                        setSearchText(suggestions[0].name);
                      }
                    }}
                    placeholder="Código ou nome do produto"
                    inputMode="search"
                    aria-label="Buscar produto por código, nome ou categoria"
                    className="h-14 bg-background pl-11 text-base"
                    disabled={!activeVisit}
                  />
                  {suggestions.length > 0 ? (
                    <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-20 overflow-hidden rounded-md border border-border bg-popover shadow-lg" role="listbox" aria-label="Sugestões de produtos">
                      {suggestions.map((product) => (
                        <button
                          key={product.code}
                          type="button"
                          role="option"
                          aria-selected={false}
                          onClick={() => {
                            setSelectedProduct(product);
                            setSearchText(product.name);
                          }}
                          className="flex min-h-14 w-full items-center justify-between gap-3 border-b border-border px-4 py-2 text-left last:border-b-0 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{product.name}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">{product.code} · {product.category}</span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">{product.unit}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {selectedProduct ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{selectedProduct.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedProduct.code} · {selectedProduct.category}</p>
                    </div>
                    <Badge variant="outline" className="bg-background">{selectedProduct.unit}</Badge>
                  </div>
                ) : null}

                <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                  <label className="grid gap-2 text-sm font-medium">
                    Quantidade em falta
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={quantityText}
                      onChange={(event) => setQuantityText(event.target.value)}
                      className="h-12 bg-background text-lg font-semibold tabular-nums"
                      disabled={!activeVisit}
                    />
                  </label>
                  <div className="grid gap-2 text-sm font-medium">
                    Ajuste rápido
                    <div className="grid grid-cols-5 gap-1.5">
                      {[...QUANTITY_PRESETS, BOX_STEP].map((step, index) => (
                        <Button
                          key={`${step}-${index}`}
                          type="button"
                          variant="outline"
                          disabled={!activeVisit}
                          onClick={() => {
                            const current = Number(quantityText);
                            setQuantityText(String(addQuantity(Number.isFinite(current) ? current : 0, step)));
                          }}
                          className="h-12 min-w-0 px-1 text-sm"
                          aria-label={index === 4 ? "Adicionar uma caixa" : `Adicionar ${step}`}
                          title={index === 4 ? "Adicionar uma caixa" : `Adicionar ${step}`}
                        >
                          {index === 4 ? "+ cx" : `+${step}`}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-2 text-sm font-medium">
                  Prioridade
                  <div className="grid grid-cols-3 gap-2">
                    {PRIORITIES.map((choice) => (
                      <Button
                        key={choice}
                        type="button"
                        variant="outline"
                        aria-pressed={priority === choice}
                        disabled={!activeVisit}
                        onClick={() => setPriority(choice)}
                        className={`h-11 px-2 ${priority === choice ? priorityStyles[choice] : "bg-background"}`}
                      >
                        {priority === choice && <Check className="size-4" aria-hidden="true" />}
                        {choice}
                      </Button>
                    ))}
                  </div>
                </div>

                <Button
                  type="button"
                  size="lg"
                  disabled={!activeVisit || !selectedProduct || addItemMutation.isPending}
                  onClick={handleAddItem}
                  className="mt-5 h-12 w-full bg-brand-green text-brand-green-foreground hover:bg-brand-green/90"
                >
                  <Plus aria-hidden="true" />
                  {addItemMutation.isPending ? "A adicionar…" : "Adicionar à lista"}
                </Button>
                {!activeVisit ? (
                  <p className="mt-3 text-center text-xs text-muted-foreground">Seleccione a empresa e inicie a vistoria para registar produtos.</p>
                ) : null}
              </div>

            <div className="min-w-0 rounded-md border border-border bg-card p-4 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">03 · Rever faltas</p>
                  <h2 className="mt-1 font-display text-xl font-semibold">Lista da vistoria</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{activeVisit?.supermarket ?? selectedStore}</p>
                </div>
                <Badge variant="secondary" className="tabular-nums">{activeItems.length} {activeItems.length === 1 ? "produto" : "produtos"}</Badge>
              </div>

              {activeVisit ? (
                <div className="mt-2 divide-y divide-border">
                  {activeItems.length === 0 ? (
                    <div className="grid min-h-56 place-items-center py-8 text-center">
                      <div>
                        <span className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
                          <Package className="size-6" aria-hidden="true" />
                        </span>
                        <p className="mt-3 text-sm font-medium">A lista está vazia</p>
                        <p className="mt-1 text-xs text-muted-foreground">Pesquise um produto para começar a vistoria.</p>
                      </div>
                    </div>
                  ) : (
                    activeItems.map((item) => (
                      <div key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold">{item.product_name}</p>
                            <Badge className={`px-2 py-0.5 ${priorityStyles[item.priority as Priority] ?? priorityStyles.Normal}`}>
                              {item.priority}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{item.product_code} · {item.category}</p>
                        </div>
                        <div className="flex items-center justify-between gap-3 sm:justify-end">
                          <div className="flex items-center gap-1 rounded-md border border-border p-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-9"
                              aria-label={`Reduzir ${item.product_name}`}
                              disabled={item.quantity <= 1 || quantityMutation.isPending}
                              onClick={() => quantityMutation.mutate({ itemId: item.id, quantity: Math.max(1, item.quantity - 1) })}
                            >
                              <Minus aria-hidden="true" />
                            </Button>
                            <span className="min-w-12 text-center text-sm font-semibold tabular-nums">{item.quantity} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span></span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-9"
                              aria-label={`Aumentar ${item.product_name}`}
                              disabled={quantityMutation.isPending}
                              onClick={() => quantityMutation.mutate({ itemId: item.id, quantity: item.quantity + 1 })}
                            >
                              <Plus aria-hidden="true" />
                            </Button>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-10 text-muted-foreground hover:text-destructive"
                            aria-label={`Remover ${item.product_name}`}
                            title="Remover produto"
                            disabled={removeItemMutation.isPending}
                            onClick={() => removeItemMutation.mutate(item.id)}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="grid min-h-56 place-items-center py-8 text-center">
                  <div>
                    <span className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
                      <ClipboardCheck className="size-6" aria-hidden="true" />
                    </span>
                    <p className="mt-3 text-sm font-medium">Pronto para uma nova vistoria</p>
                    <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">Seleccione a empresa e inicie a vistoria para começar a registar os produtos em falta.</p>
                  </div>
                </div>
              )}

              <div className="mt-2 border-t border-border pt-4">
                <div className="mb-4 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total de unidades em falta</span>
                  <span className="font-semibold tabular-nums">{activeItems.reduce((total, item) => total + item.quantity, 0)}</span>
                </div>
                <Button
                  type="button"
                  disabled={!activeVisit || !canCompleteVisit(activeItems.length) || completeVisitMutation.isPending}
                  onClick={() => {
                    if (!activeVisit) return;
                    const confirmed = window.confirm("Tem a certeza de que pretende finalizar esta vistoria?");
                    if (confirmed) completeVisitMutation.mutate(activeVisit.id);
                  }}
                  className="h-12 w-full bg-brand-navy text-brand-navy-foreground hover:bg-brand-navy/90"
                >
                  <CheckCircle2 aria-hidden="true" />
                  {completeVisitMutation.isPending ? "A concluir…" : "Concluir vistoria"}
                </Button>
              </div>
            </div>
              </section>
            ) : null}
          </section>
        ) : null}

        {mode === "office" ? (
          <section className="space-y-6">
            <div className="no-print flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
              <label className="grid w-full max-w-xl gap-2 text-sm font-medium">
                Vistoria para lançamento
                <Select value={officeVisit?.id ?? "none"} onValueChange={setOfficeVisitId}>
                  <SelectTrigger className="h-12 bg-card">
                    <SelectValue placeholder="Selecione uma vistoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma vistoria concluída</SelectItem>
                    {officeVisits.map((visit) => (
                      <SelectItem key={visit.id} value={visit.id}>
                        {visit.visit_code ?? "Sem código"} · {visit.supermarket} · {formatDateTime(visit.started_at)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              {officeVisit ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={handleCopyAll} className="h-11">
                    <Copy aria-hidden="true" /> Copiar todos
                  </Button>
                  <Button type="button" variant="outline" onClick={handleExportCsv} className="h-11">
                    <Download aria-hidden="true" /> Exportar CSV
                  </Button>
                  <Button type="button" onClick={() => window.print()} className="h-11">
                    <Printer aria-hidden="true" /> Imprimir guia
                  </Button>
                </div>
              ) : null}
            </div>

            {officeVisit ? (
              <div id="office-guide" className="space-y-5">
                <div className="flex flex-col justify-between gap-3 border-b border-border pb-5 sm:flex-row sm:items-end">
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Guia de separação</p>
                    <h2 className="mt-1 font-display text-2xl font-semibold">{officeVisit.supermarket}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{officeVisit.visit_code} · {formatDateTime(officeVisit.started_at)} · {officeVisit.operator_name}</p>
                  </div>
                  <Badge className={officeVisit.status === "launched" ? "border-success/20 bg-success/10 text-success" : "border-warning/20 bg-warning/10 text-warning-foreground"}>
                    {officeVisit.status === "launched" ? "Lançamento concluído" : "Lançamento pendente"}
                  </Badge>
                </div>

                <div className="overflow-x-auto rounded-md border border-border bg-card">
                  <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                    <thead className="bg-muted text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Código do produto</th>
                        <th className="px-4 py-3 font-semibold">Nome / descrição</th>
                        <th className="px-4 py-3 font-semibold">Quantidade</th>
                        <th className="px-4 py-3 font-semibold">Prioridade</th>
                        <th className="px-4 py-3 font-semibold">Copiar</th>
                        <th className="px-4 py-3 font-semibold">Lançado no ERP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {officeItems.map((item) => (
                        <tr key={item.id} className={item.launched ? "bg-muted/60 text-muted-foreground" : ""}>
                          <td className="whitespace-nowrap px-4 py-4 font-mono text-xs">{item.product_code}</td>
                          <td className="px-4 py-4">
                            <p className={`font-medium ${item.launched ? "line-through" : ""}`}>{item.product_name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{item.category}</p>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 font-semibold tabular-nums">{item.quantity} {item.unit}</td>
                          <td className="px-4 py-4">
                            <Badge className={priorityStyles[item.priority as Priority] ?? priorityStyles.Normal}>{item.priority}</Badge>
                          </td>
                          <td className="px-4 py-4">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              aria-label={`Copiar código e quantidade de ${item.product_name}`}
                              onClick={() => void handleCopy(`${item.product_code}\t${item.quantity}`, "Código e quantidade copiados.")}
                            >
                              <Copy aria-hidden="true" /> Copiar
                            </Button>
                          </td>
                          <td className="px-4 py-4">
                            <label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap text-xs font-medium">
                              <Checkbox
                                checked={item.launched}
                                onCheckedChange={(checked) => launchItemMutation.mutate({ item, launched: checked === true })}
                                disabled={launchItemMutation.isPending}
                                aria-label={`Marcar ${item.product_name} como lançado no ERP`}
                              />
                              {item.launched ? "Concluído" : "Marcar lançado"}
                            </label>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {officeItems.length === 0 ? (
                    <div className="p-10 text-center text-sm text-muted-foreground">Esta vistoria não tem produtos registados.</div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                  <span>{officeItems.length} produtos · {officeItems.reduce((sum, item) => sum + item.quantity, 0)} unidades</span>
                  <span>{officeItems.filter((item) => item.launched).length} de {officeItems.length} lançados</span>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<ClipboardList className="size-6" aria-hidden="true" />}
                title="Nenhuma vistoria para lançar"
                description="As vistorias concluídas aparecerão aqui para serem copiadas ou lançadas no sistema central."
              />
            )}
          </section>
        ) : null}

        {mode === "history" ? (
          <section className="space-y-7">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Metric
                icon={<Clock3 className="size-5" aria-hidden="true" />}
                label="Tempo médio de vistoria"
                value={formatDuration(averageDuration)}
                note={`${completedVisits.length} ${completedVisits.length === 1 ? "vistoria concluída" : "vistorias concluídas"}`}
              />
              <Metric
                icon={<Store className="size-5" aria-hidden="true" />}
                label="Lojas com reposição pendente"
                value={String(pendingStores.size)}
                note="Lojas com itens por lançar"
              />
              <Metric
                icon={<Activity className="size-5" aria-hidden="true" />}
                label="Economia estimada por vistoria"
                value="≈ 20 min"
                note="Estimativa provisória · por visita concluída"
              />
            </div>

            <div className="border-y border-border py-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Arquivo operacional</p>
                  <h2 className="mt-1 font-display text-xl font-semibold">Vistorias realizadas</h2>
                </div>
                <span className="text-sm text-muted-foreground">{historyVisits.length} registos</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="grid gap-2 text-xs font-semibold uppercase text-muted-foreground">
                  Supermercado
                  <Select value={historyStore} onValueChange={setHistoryStore}>
                    <SelectTrigger className="h-11 bg-card text-sm font-normal normal-case text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os supermercados</SelectItem>
                      {SUPERMARKETS.map((store) => <SelectItem key={store} value={store}>{store}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
                <label className="grid gap-2 text-xs font-semibold uppercase text-muted-foreground">
                  De
                  <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-11 bg-card text-sm font-normal normal-case text-foreground" />
                </label>
                <label className="grid gap-2 text-xs font-semibold uppercase text-muted-foreground">
                  Até
                  <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-11 bg-card text-sm font-normal normal-case text-foreground" />
                </label>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full"
                    onClick={() => {
                      setHistoryStore("all");
                      setDateFrom("");
                      setDateTo("");
                    }}
                  >
                    Limpar filtros
                  </Button>
                </div>
              </div>

              <div className="mt-5 divide-y divide-border border-y border-border">
                {historyVisits.length > 0 ? historyVisits.map((visit) => {
                  const items = data.items.filter((item) => item.visit_id === visit.id);
                  const pendingCount = items.filter((item) => !item.launched).length;
                  return (
                    <article key={visit.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(140px,0.7fr)_minmax(120px,0.6fr)_auto] sm:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{visit.supermarket}</h3>
                          <Badge variant="outline" className="font-mono text-xs">{visit.visit_code ?? "Em andamento"}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{visit.operator_name} · {items.length} {items.length === 1 ? "produto" : "produtos"}</p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarDays className="size-4" aria-hidden="true" />
                        {formatDateTime(visit.started_at)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{formatDuration(durationInMinutes(visit.started_at, visit.completed_at))}</span>
                        {pendingCount > 0 ? <span className="ml-2 text-warning-foreground">· {pendingCount} pendentes</span> : null}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        className="justify-self-start sm:justify-self-end"
                        onClick={() => {
                          setOfficeVisitId(visit.id);
                          setMode("office");
                        }}
                        disabled={visit.status === "in_progress"}
                      >
                        Abrir <ArrowRight aria-hidden="true" />
                      </Button>
                    </article>
                  );
                }) : (
                  <div className="py-12 text-center">
                    <History className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
                    <p className="mt-3 text-sm font-medium">Nenhuma vistoria neste período</p>
                    <p className="mt-1 text-xs text-muted-foreground">Ajuste os filtros ou conclua uma vistoria de campo.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {completionChoiceOpen ? (
        <div className="no-print fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="completion-choice-title">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="size-7" aria-hidden="true" />
            </span>
            <h2 id="completion-choice-title" className="mt-4 text-center font-display text-2xl font-semibold">Vistoria finalizada</h2>
            <p className="mt-2 text-center text-sm leading-6 text-muted-foreground">A vistoria foi guardada com sucesso. O que pretende fazer agora?</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="outline" className="h-12" onClick={() => { setCompletionChoiceOpen(false); setFieldStarted(false); setMode("menu"); }}>
                Voltar ao menu principal
              </Button>
              <Button type="button" className="h-12 bg-brand-green text-brand-green-foreground hover:bg-brand-green/90" onClick={() => { setCompletionChoiceOpen(false); setFieldStarted(false); setMode("office"); }}>
                Ver relatório da vistoria
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="no-print mt-10 flex flex-col gap-2 border-t border-border pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-2"><MapPin className="size-3.5" aria-hidden="true" /> Operação Maxi Armazém · Maputo, Moçambique</span>
          <span>Catálogo de demonstração · {PRODUCT_CATALOG.length} produtos</span>
        </footer>
      </div>
    </main>
  );
}

function Metric({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return (
    <article className="min-w-0 rounded-md border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="grid size-8 place-items-center rounded-md bg-muted text-brand-navy">{icon}</span>
        <h3 className="text-xs font-semibold uppercase">{label}</h3>
      </div>
      <p className="mt-4 truncate font-display text-2xl font-semibold text-foreground" title={value}>{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground" title={note}>{note}</p>
    </article>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="grid min-h-64 place-items-center rounded-md border border-dashed border-border bg-card px-5 py-10 text-center">
      <div>
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">{icon}</span>
        <h2 className="mt-3 font-display text-lg font-semibold">{title}</h2>
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
