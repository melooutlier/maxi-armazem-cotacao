import { useMemo, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Boxes,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Copy,
  History,
  MapPin,
  Minus,
  Package,
  Pencil,
  Plus,
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
  PRODUCT_CATALOG,
  QUANTITY_PRESETS,
  addQuantity,
  canCompleteVisit,
  fieldVisitQueryOptions,
  formatDateTime,
  formatDuration,
  getStockLevel,
  localDateValue,
  type CatalogProduct,
  type Visit,
  type VisitItem,
} from "@/lib/field-visits";
import { supabase } from "@/integrations/supabase/client";

type ViewMode = "menu" | "field" | "office" | "history" | "cadastro";

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
  { id: "cadastro", label: "Cadastro", icon: ClipboardCheck },
];

function Index() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(fieldVisitQueryOptions);
  const [mode, setMode] = useState<ViewMode>("menu");
  const [fieldStarted, setFieldStarted] = useState(false);
  const [completionChoiceOpen, setCompletionChoiceOpen] = useState(false);
  const [completionConfirmOpen, setCompletionConfirmOpen] = useState(false);
  const [stockWarningProduct, setStockWarningProduct] = useState<CatalogProduct | null>(null);
  const [selectedStore, setSelectedStore] = useState<string>("VIP Spar Sommerschield");
  const [operatorName, setOperatorName] = useState("Utilizador autenticado");
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [officeVisitId, setOfficeVisitId] = useState("");
  const [historyStore, setHistoryStore] = useState("all");
  const [historyStatus, setHistoryStatus] = useState<"all" | "pending" | "completed">("all");
  const [companyName, setCompanyName] = useState("");
  const [cadastroSection, setCadastroSection] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editingCompanyName, setEditingCompanyName] = useState("");
  const [editingCompanyActive, setEditingCompanyActive] = useState(true);
  const [companyToDelete, setCompanyToDelete] = useState<{ id: string; name: string } | null>(null);
  const [officeEntered, setOfficeEntered] = useState(false);
  const [showCompletedVisits, setShowCompletedVisits] = useState(false);
  const [officeDateFrom, setOfficeDateFrom] = useState("");
  const [officeDateTo, setOfficeDateTo] = useState("");
  const [officeCompanyFilter, setOfficeCompanyFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchText, setSearchText] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [quantityText, setQuantityText] = useState("1");
  const [clock, setClock] = useState<Date | null>(null);

  useEffect(() => {
    setClock(new Date());
    let mounted = true;
    void supabase.auth.getUser().then(({ data: authData }) => {
      if (!mounted) return;
      const user = authData.user;
      const metadataName =
        user?.user_metadata?.["username"] ??
        user?.user_metadata?.["full_name"] ??
        user?.user_metadata?.["name"] ??
        user?.user_metadata?.["display_name"];
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

  const createCompanyMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data: company, error } = await supabase.from("companies").insert({ name }).select().single();
      if (error) throw error;
      return company;
    },
    onSuccess: (company) => {
      queryClient.setQueryData(fieldVisitQueryOptions.queryKey, (current: typeof data | undefined) =>
        current ? { ...current, companies: [...current.companies, company].sort((a, b) => a.name.localeCompare(b.name, "pt-MZ")) } : current,
      );
      setSelectedStore(company.name);
      setCompanyName("");
      toast.success("Empresa cadastrada com sucesso.");
    },
    onError: (error) => toast.error(error.message.includes("companies_name_key") ? "Já existe uma empresa com esse nome." : `Não foi possível cadastrar a empresa: ${error.message}`),
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async ({ id, name, active }: { id: string; name: string; active: boolean }) => {
      const { data: company, error } = await supabase.from("companies").update({ name, active }).eq("id", id).select().single();
      if (error) throw error;
      return company;
    },
    onSuccess: (company) => {
      queryClient.setQueryData(fieldVisitQueryOptions.queryKey, (current: typeof data | undefined) =>
        current ? { ...current, companies: current.companies.map((entry) => entry.id === company.id ? company : entry).sort((a, b) => a.name.localeCompare(b.name, "pt-MZ")) } : current,
      );
      setEditingCompanyId(null);
      toast.success("Empresa actualizada com sucesso.");
    },
    onError: (error) => toast.error(error.message.includes("companies_name_key") ? "Já existe uma empresa com esse nome." : `Não foi possível actualizar a empresa: ${error.message}`),
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData(fieldVisitQueryOptions.queryKey, (current: typeof data | undefined) =>
        current ? { ...current, companies: current.companies.filter((company) => company.id !== id) } : current,
      );
      setCompanyToDelete(null);
      toast.success("Empresa eliminada com sucesso.");
    },
    onError: (error) => toast.error(`Não foi possível eliminar a empresa: ${error.message}`),
  });

  const discountMutation = useMutation({
    mutationFn: async ({ visitId, discount }: { visitId: string; discount: number }) => {
      const { data: visit, error } = await supabase.from("visits").update({ discount_percent: discount }).eq("id", visitId).select().single();
      if (error) throw error;
      return visit;
    },
    onSuccess: (savedVisit) => {
      queryClient.setQueryData(fieldVisitQueryOptions.queryKey, (current: typeof data | undefined) =>
        current ? { ...current, visits: current.visits.map((visit) => visit.id === savedVisit.id ? savedVisit : visit) } : current,
      );
      toast.success("Desconto geral actualizado.");
    },
    onError: (error) => toast.error(`Não foi possível guardar o desconto geral: ${error.message}`),
  });

  const itemDiscountMutation = useMutation({
    mutationFn: async ({ itemId, discount }: { itemId: string; discount: number }) => {
      const { data: item, error } = await supabase.from("visit_items").update({ discount_percent: discount }).eq("id", itemId).select().single();
      if (error) throw error;
      return item;
    },
    onSuccess: (savedItem) => {
      queryClient.setQueryData(fieldVisitQueryOptions.queryKey, (current: typeof data | undefined) =>
        current ? { ...current, items: current.items.map((item) => item.id === savedItem.id ? savedItem : item) } : current,
      );
      toast.success("Desconto do produto actualizado.");
    },
    onError: (error) => toast.error(`Não foi possível guardar o desconto do produto: ${error.message}`),
  });

  const startVisitMutation = useMutation({
    mutationFn: async ({ supermarket, operator }: { supermarket: string; operator: string }) => {
      const { data: visit, error } = await supabase
        .from("visits")
        .insert({ supermarket, operator_name: operator, status: "in_progress", is_priority: false })
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
    }) => {
      const existing = data.items.find(
        (item) => item.visit_id === input.visitId && item.product_code === input.product.code,
      );
      const result = existing
        ? await supabase
            .from("visit_items")
            .update({ quantity: addQuantity(existing.quantity, input.quantity), priority: "" })
            .eq("id", existing.id)
            .select()
            .single()
        : await supabase.from("visit_items").insert({
            visit_id: input.visitId,
            product_code: input.product.code,
            product_name: input.product.name,
            category: input.product.category,
            unit: input.product.unit,
            quantity: input.quantity,
            priority: "",
            discount_percent: 0,
          }).select().single();
      if (result.error) throw result.error;
      return result.data as VisitItem;
    },
    onSuccess: async (savedItem) => {
      queryClient.setQueryData(fieldVisitQueryOptions.queryKey, (current: typeof data | undefined) => {
        if (!current) return current;
        const exists = current.items.some((item) => item.id === savedItem.id);
        return {
          ...current,
          items: exists
            ? current.items.map((item) => item.id === savedItem.id ? savedItem : item)
            : [...current.items, savedItem],
        };
      });
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

  const activeCompanies = data.companies.filter((company) => company.active);
  const companies = activeCompanies.map((company) => company.name);
  const officeVisits = data.visits.filter((visit) => {
    const visitDay = localDateValue(visit.started_at);
    const matchesCompany = officeCompanyFilter === "all" || visit.supermarket === officeCompanyFilter;
    return visit.status !== "in_progress" &&
      matchesCompany &&
      (!officeDateFrom || visitDay >= officeDateFrom) &&
      (!officeDateTo || visitDay <= officeDateTo);
  });
  const officeVisit =
    (officeVisitId ? data.visits.find((visit) => visit.id === officeVisitId && visit.status !== "in_progress") : null) ??
    officeVisits[0] ??
    null;
  const officeItems = officeVisit
    ? data.items.filter((item) => item.visit_id === officeVisit.id)
    : [];

  const isVisitFullyLaunched = (visit: Visit) => {
    const items = data.items.filter((item) => item.visit_id === visit.id);
    return visit.status === "launched" || (items.length > 0 && items.every((item) => item.launched));
  };
  const matchesOfficeFilters = (visit: Visit) => {
    const visitDay = localDateValue(visit.started_at);
    const matchesCompany = officeCompanyFilter === "all" || visit.supermarket === officeCompanyFilter;
    return matchesCompany &&
      (!officeDateFrom || visitDay >= officeDateFrom) &&
      (!officeDateTo || visitDay <= officeDateTo);
  };
  const fieldPendingVisits = data.visits
    .filter((visit) => visit.status === "completed" && !isVisitFullyLaunched(visit) && matchesOfficeFilters(visit))
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  const fieldCompletedVisits = data.visits
    .filter((visit) => visit.status !== "in_progress" && isVisitFullyLaunched(visit) && matchesOfficeFilters(visit))
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  const openVisitInOffice = (visit: Visit) => {
    setOfficeEntered(true);
    setOfficeVisitId(visit.id);
    setMode("office");
  };

  const historyVisits = data.visits.filter((visit) => {
    const visitDay = localDateValue(visit.started_at);
    const matchesStore = historyStore === "all" || visit.supermarket === historyStore;
    const matchesFrom = dateFrom.length === 0 || visitDay >= dateFrom;
    const matchesTo = dateTo.length === 0 || visitDay <= dateTo;
    const items = data.items.filter((item) => item.visit_id === visit.id);
    const isPending = visit.status === "in_progress" || (visit.status === "completed" && items.some((item) => !item.launched));
    const isCompleted = visit.status === "launched" || (visit.status === "completed" && items.length > 0 && items.every((item) => item.launched));
    const matchesStatus = historyStatus === "all" || (historyStatus === "pending" ? isPending : isCompleted);
    return matchesStore && matchesFrom && matchesTo && matchesStatus;
  });

  const handleStartVisit = () => {
    const operator = operatorName.trim();
    if (!operator) {
      toast.error("Não foi possível identificar o utilizador autenticado.");
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
    const alreadyRequested = activeItems.find((item) => item.product_code === selectedProduct.code)?.quantity ?? 0;
    if (alreadyRequested + quantity > selectedProduct.stock) {
      setStockWarningProduct(selectedProduct);
      return;
    }
    addItemMutation.mutate({ visitId: activeVisit.id, product: selectedProduct, quantity });
  };

  const confirmAddWithInsufficientStock = () => {
    if (!activeVisit || !selectedProduct) return;
    const quantity = Number(quantityText);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Informe uma quantidade maior que zero.");
      setStockWarningProduct(null);
      return;
    }
    addItemMutation.mutate({ visitId: activeVisit.id, product: selectedProduct, quantity });
    setStockWarningProduct(null);
  };

  const handleCopy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message);
    } catch {
      toast.error("Não foi possível copiar. Verifique as permissões do navegador.");
    }
  };

  const handleMarkAllLaunched = async () => {
    if (!officeVisit || officeItems.length === 0) return;
    const pendingItems = officeItems.filter((item) => !item.launched);
    if (pendingItems.length === 0) {
      toast.info("Todos os produtos já estão marcados como lançados.");
      return;
    }
    const { error } = await supabase.from("visit_items").update({ launched: true }).eq("visit_id", officeVisit.id).eq("launched", false);
    if (error) {
      toast.error(`Não foi possível concluir os lançamentos: ${error.message}`);
      return;
    }
    const { error: visitError } = await supabase.from("visits").update({ status: "launched" }).eq("id", officeVisit.id);
    if (visitError) {
      toast.error(`Produtos lançados, mas não foi possível actualizar o estado da vistoria: ${visitError.message}`);
      await refreshVisits();
      return;
    }
    await refreshVisits();
    toast.success(`${pendingItems.length} produto(s) marcado(s) como lançado(s).`);
  };

  const formatPrimaveraQuantity = (quantity: number) =>
    quantity.toLocaleString("pt-MZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getPrimaveraRow = (item: VisitItem) => {
    if (!officeVisit) return [];
    const totalDiscount = 100 * (1 - (1 - officeVisit.discount_percent / 100) * (1 - item.discount_percent / 100));
    // Primavera: Artigo, Arm., Localização, Lote, Descrição, CIVA, IVA, Pr. Unit., Desc., UN, Qtd., Total Liq., Contrato
    return [
      item.product_code, "", "", "", item.product_name, "", "", "",
      totalDiscount.toLocaleString("pt-MZ", { maximumFractionDigits: 2 }), item.unit,
      formatPrimaveraQuantity(item.quantity), "", "",
    ];
  };

  const handleCopyAll = () => {
    if (!officeVisit) return;
    const lines = officeItems.map((item) => getPrimaveraRow(item).join("\t"));
    void handleCopy(lines.join("\n"), "Lista formatada para colar no Primavera.");
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
        "Desconto individual (%)",
        "Desconto geral (%)",
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
          item.discount_percent,
          officeVisit.discount_percent,
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
    <main className={mode === "field" && !fieldStarted && !activeVisit ? "flex h-[100svh] flex-col overflow-hidden bg-background text-foreground" : "min-h-screen bg-background text-foreground"}>
      <header className="no-print shrink-0 border-b border-brand-navy/15 bg-brand-navy text-brand-navy-foreground">
        <div className={`mx-auto flex max-w-[1440px] flex-col gap-2 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 ${mode === "field" && !fieldStarted && !activeVisit ? "py-2" : "py-4"}`}>
          <div className="flex items-center justify-between gap-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`grid shrink-0 place-items-center rounded-md bg-brand-green text-brand-green-foreground ${mode === "field" && !fieldStarted && !activeVisit ? "size-9" : "size-11"}`}>
                <Boxes className="size-6" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-lg font-semibold leading-tight">Maxi Armazém</p>
                {mode === "field" && !fieldStarted && !activeVisit ? null : <p className="text-xs text-brand-navy-foreground/70">Operação de reposição</p>}
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
              className={`border-brand-navy-foreground/30 bg-brand-navy-foreground/10 text-brand-navy-foreground hover:bg-brand-navy-foreground/20 ${mode === "field" && !fieldStarted && !activeVisit ? "h-9" : ""}`}
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

      <div className={mode === "field" && !fieldStarted && !activeVisit ? "mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col overflow-hidden px-3 pb-2 pt-1 sm:px-6 lg:px-8" : "mx-auto max-w-[1440px] px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pt-9"}>
        <div className={`no-print flex flex-col gap-2 border-b border-border pb-2 sm:flex-row sm:items-end sm:justify-between ${mode === "field" && !fieldStarted && !activeVisit ? "mb-1 shrink-0" : "mb-7"}`}>
          <div>
            <p className={`mb-1 inline-flex items-center gap-2 text-xs font-semibold uppercase text-success ${mode === "field" && !fieldStarted && !activeVisit ? "hidden" : ""}`}>
              <span className="size-2 rounded-full bg-success" />
              Sistema de gestão flexível
            </p>
            <h1 className={`font-display font-semibold tracking-normal text-foreground ${mode === "field" && !fieldStarted && !activeVisit ? "text-lg" : "text-3xl sm:text-4xl"}`}>
              {mode === "menu" ? "Área de trabalho" : mode === "field" ? "Vistoria em campo" : mode === "office" ? (officeEntered ? "Detalhes da vistoria" : "Lançamento no escritório") : mode === "cadastro" ? "Cadastro" : "Histórico & relatórios"}
            </h1>
            <p className={`mt-1 max-w-2xl text-sm leading-5 text-muted-foreground sm:text-base ${mode === "field" && !fieldStarted && !activeVisit ? "hidden" : ""}`}>
              {mode === "menu"
                ? "Escolha a área em que pretende trabalhar."
                : mode === "field"
                  ? (fieldStarted || activeVisit ? "Pesquise os produtos no catálogo e registe as faltas da empresa." : "Escolha a empresa para iniciar uma nova vistoria.")
                  : mode === "office"
                    ? (officeEntered ? "Consulte os produtos da vistoria e registe os lançamentos no sistema." : "Transfira os pedidos para o sistema central e acompanhe cada lançamento.")
                    : mode === "cadastro"
                      ? "Cadastre e consulte as empresas utilizadas nas vistorias."
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
          <section className="mx-auto grid max-w-6xl gap-5 py-8 sm:grid-cols-2 xl:grid-cols-4">
            {MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setMode(id);
                  if (id === "field") {
                    setFieldStarted(false);
                  }
                  if (id === "office") {
                    setOfficeEntered(false);
                    setOfficeVisitId("");
                    setShowCompletedVisits(false);
                  }
                }}
                className="group flex min-h-56 flex-col items-start justify-between rounded-xl border border-border bg-card p-7 text-left shadow-sm transition hover:-translate-y-1 hover:border-brand-green hover:shadow-md"
              >
                <span className="grid size-14 place-items-center rounded-xl bg-brand-green/15 text-brand-navy">
                  <Icon className="size-7" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-display text-2xl font-semibold">{label}</span>
                  <span className="mt-2 block text-sm text-muted-foreground">
                    {id === "field" ? "Iniciar e registar uma vistoria nas lojas." : id === "office" ? "Consultar listas e preparar lançamentos." : id === "history" ? "Consultar vistorias e indicadores anteriores." : "Cadastrar e gerir as empresas onde são feitas as vistorias."}
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
          <section className={mode === "field" && !fieldStarted && !activeVisit ? "flex min-h-0 flex-1 flex-col" : "space-y-6"}>
            {!fieldStarted && !activeVisit ? (
              <section className="grid min-h-0 flex-1 place-items-center overflow-hidden py-1">
                <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-3 shadow-lg sm:p-4">
                  <div className="mx-auto mb-2 grid size-9 place-items-center rounded-xl bg-brand-green/15 text-brand-navy sm:size-10">
                    <Store className="size-5" aria-hidden="true" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-success">Vistoria de campo</p>
                    <h2 className="mt-2 font-display text-2xl font-semibold">Escolher empresa</h2>
                    <p className="mt-1 text-xs leading-4 text-muted-foreground">Seleccione a empresa onde pretende realizar a vistoria.</p>
                  </div>
                  <label className="mt-3 grid gap-1 text-sm font-medium">
                    Empresa
                    <Select value={selectedStore} onValueChange={setSelectedStore}>
                      <SelectTrigger className="h-10 bg-background text-left">
                        <SelectValue placeholder="Escolha a empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {data.companies.map((company) => (
                          <SelectItem key={company.id} value={company.name}>{company.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
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
                    className="mt-3 h-10 w-full bg-brand-green text-brand-green-foreground hover:bg-brand-green/90"
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
                          <span className="shrink-0 text-right">
                            <span className="block text-sm font-semibold tabular-nums">{product.stock} un.</span>
                            <span className={`block text-[10px] font-semibold uppercase ${getStockLevel(product.stock) === "very-low" ? "text-red-600" : getStockLevel(product.stock) === "low" ? "text-amber-600" : "text-green-600"}`}>
                              {getStockLevel(product.stock) === "very-low" ? "Muito baixo" : getStockLevel(product.stock) === "low" ? "Baixo" : "Normal"}
                            </span>
                          </span>
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
                      <p className="mt-1 text-xs font-semibold">Stock disponível: {selectedProduct.stock} unidades</p>
                    </div>
                    <Badge variant="outline" className={getStockLevel(selectedProduct.stock) === "very-low" ? "border-red-200 bg-red-50 text-red-700" : getStockLevel(selectedProduct.stock) === "low" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-green-200 bg-green-50 text-green-700"}>
                      {getStockLevel(selectedProduct.stock) === "very-low" ? "Stock muito baixo" : getStockLevel(selectedProduct.stock) === "low" ? "Stock baixo" : "Stock normal"}
                    </Badge>
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
                <div className="mt-4 rounded-lg border border-brand-green/30 bg-brand-green/5 p-4">
                  <label className="flex flex-col gap-2 text-sm font-semibold sm:flex-row sm:items-center sm:justify-between">
                    <span>Desconto geral para todos os produtos</span>
                    <span className="flex items-center gap-2"><Input key={activeVisit.id + String(activeVisit.discount_percent)} type="number" min="0" max="100" step="0.01" defaultValue={activeVisit.discount_percent} aria-label="Desconto geral em percentagem" className="h-10 w-28 bg-background text-right tabular-nums" onBlur={(event) => { const discount = Number(event.currentTarget.value || 0); if (Number.isFinite(discount) && discount >= 0 && discount <= 100 && discount !== activeVisit.discount_percent) discountMutation.mutate({ visitId: activeVisit.id, discount }); else if (!Number.isFinite(discount) || discount < 0 || discount > 100) { event.currentTarget.value = String(activeVisit.discount_percent); toast.error("O desconto deve estar entre 0% e 100%."); } }} /><span>%</span></span>
                  </label>
                  <p className="mt-1 text-xs text-muted-foreground">Este desconto é aplicado a todos os produtos. Pode acrescentar um desconto específico em cada produto abaixo.</p>
                </div>
              ) : null}

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
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{item.product_code} · {item.category}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <label className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">Desconto individual <Input key={item.id + String(item.discount_percent)} type="number" min="0" max="100" step="0.01" defaultValue={item.discount_percent} aria-label={`Desconto individual de ${item.product_name} em percentagem`} className="h-9 w-20 bg-background text-right tabular-nums" onBlur={(event) => { const discount = Number(event.currentTarget.value || 0); if (Number.isFinite(discount) && discount >= 0 && discount <= 100 && discount !== item.discount_percent) itemDiscountMutation.mutate({ itemId: item.id, discount }); else if (!Number.isFinite(discount) || discount < 0 || discount > 100) { event.currentTarget.value = String(item.discount_percent); toast.error("O desconto deve estar entre 0% e 100%."); } }} /> %</label>
                            <span className="text-xs font-semibold text-success">Desconto total aplicado: {(100 * (1 - (1 - (activeVisit?.discount_percent ?? 0) / 100) * (1 - item.discount_percent / 100))).toLocaleString("pt-MZ", { maximumFractionDigits: 2 })}%</span>
                          </div>
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
                  <span className="text-muted-foreground">Total de produtos</span>
                  <span className="font-semibold tabular-nums">{activeItems.length}</span>
                </div>
                <Button
                  type="button"
                  disabled={!activeVisit || !canCompleteVisit(activeItems.length) || completeVisitMutation.isPending}
                  onClick={() => {
                    if (!activeVisit) return;
                    setCompletionConfirmOpen(true);
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
            {!officeEntered ? (
            <div className="mb-7 space-y-5">
                <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
                  <div className="mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filtrar vistorias</p>
                    <h2 className="mt-1 font-display text-lg font-semibold">Período e empresa</h2>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="grid gap-2 text-sm font-medium">Data inicial
                      <Input type="date" value={officeDateFrom} onChange={(event) => setOfficeDateFrom(event.target.value)} className="h-11 bg-background" />
                    </label>
                    <label className="grid gap-2 text-sm font-medium">Data final
                      <Input type="date" value={officeDateTo} onChange={(event) => setOfficeDateTo(event.target.value)} className="h-11 bg-background" />
                    </label>
                    <label className="grid gap-2 text-sm font-medium">Empresa
                      <Select value={officeCompanyFilter} onValueChange={setOfficeCompanyFilter}>
                        <SelectTrigger className="h-11 bg-background"><SelectValue placeholder="Todas as empresas" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as empresas</SelectItem>
                          {data.companies.map((company) => <SelectItem key={company.id} value={company.name}>{company.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </label>
                    <div className="flex items-end">
                      <Button type="button" variant="outline" className="h-11 w-full" onClick={() => { setOfficeDateFrom(""); setOfficeDateTo(""); setOfficeCompanyFilter("all"); }}>
                        Limpar filtros
                      </Button>
                    </div>
                  </div>
                </section>
                <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-warning-foreground">A aguardar lançamento</p>
                      <h2 className="mt-1 font-display text-xl font-semibold">Vistorias por lançar no sistema</h2>
                      <p className="mt-1 text-sm text-muted-foreground">As vistorias mais recentes aparecem primeiro.</p>
                    </div>
                    <Badge variant="secondary">{fieldPendingVisits.length} pendentes</Badge>
                  </div>
                  {fieldPendingVisits.length ? (
                    <div className="divide-y divide-border">
                      {fieldPendingVisits.map((visit) => {
                        const items = data.items.filter((item) => item.visit_id === visit.id);
                        const pendingCount = items.filter((item) => !item.launched).length;
                        return (
                          <article key={visit.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-warning/10 text-warning-foreground"><ClipboardList className="size-5" aria-hidden="true" /></div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate font-semibold">{visit.supermarket}</h3>
                                <Badge variant="outline" className="font-mono text-xs">{visit.visit_code ?? "Sem código"}</Badge>
                                <Badge className="border-warning/20 bg-warning/10 text-warning-foreground">Por lançar</Badge>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(visit.started_at)} · {visit.operator_name} · {items.length} produtos · {pendingCount} por lançar</p>
                            </div>
                            <Button type="button" onClick={() => openVisitInOffice(visit)} className="shrink-0 bg-brand-green text-brand-green-foreground hover:bg-brand-green/90">Abrir lançamento <ArrowRight aria-hidden="true" /></Button>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border py-8 text-center">
                      <CheckCircle2 className="mx-auto size-7 text-success" aria-hidden="true" />
                      <p className="mt-2 text-sm font-medium">Não existem vistorias por lançar</p>
                      <p className="mt-1 text-xs text-muted-foreground">Quando uma vistoria for concluída no Campo, aparecerá aqui.</p>
                    </div>
                  )}
                </section>

                <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
                  <button type="button" aria-expanded={showCompletedVisits} onClick={() => setShowCompletedVisits((visible) => !visible)} className="mb-4 flex w-full flex-wrap items-center justify-between gap-2 text-left">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-success">Lançamento concluído</p>
                      <h2 className="mt-1 font-display text-xl font-semibold">Vistorias concluídas</h2>
                      <p className="mt-1 text-sm text-muted-foreground">Vistorias já lançadas no sistema.</p>
                    </div>
                    <span className="flex items-center gap-2"><Badge variant="secondary">{fieldCompletedVisits.length} concluídas</Badge><span className="text-sm font-medium text-muted-foreground">{showCompletedVisits ? "Ocultar" : "Mostrar"}</span><ArrowRight className={`size-4 transition-transform ${showCompletedVisits ? "rotate-90" : ""}`} aria-hidden="true" /></span>
                  </button>
                  {showCompletedVisits ? (
                    <div className="divide-y divide-border">
                      {fieldCompletedVisits.map((visit) => {
                        const items = data.items.filter((item) => item.visit_id === visit.id);
                        return (
                          <article key={visit.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-success/10 text-success"><CheckCircle2 className="size-5" aria-hidden="true" /></div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate font-semibold">{visit.supermarket}</h3>
                                <Badge variant="outline" className="font-mono text-xs">{visit.visit_code ?? "Sem código"}</Badge>
                                <Badge className="border-success/20 bg-success/10 text-success">Concluída</Badge>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(visit.started_at)} · {visit.operator_name} · {items.length} produtos</p>
                            </div>
                            <Button type="button" variant="outline" onClick={() => openVisitInOffice(visit)} className="shrink-0">Consultar <ArrowRight aria-hidden="true" /></Button>
                          </article>
                        );
                      })}
                    </div>
                  ) : null}
                </section>

            </div>
            ) : null}
            {officeEntered ? (
            <>
            <div className="no-print space-y-4 border-b border-border pb-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Vistoria seleccionada</p>
                  <h2 className="font-display text-xl font-semibold">{officeVisit?.supermarket ?? "Detalhes da vistoria"}</h2>
                </div>
                <Button type="button" variant="outline" onClick={() => { setOfficeEntered(false); setOfficeVisitId(""); }}>Voltar à visão geral</Button>
              </div>
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
                  <Button type="button" onClick={handleMarkAllLaunched} disabled={launchItemMutation.isPending || officeItems.every((item) => item.launched)} className="h-11">
                    <CheckCircle2 aria-hidden="true" /> Marcar todos como lançados
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
                    <p className="mt-1 text-sm font-semibold text-success">Desconto geral da empresa: {officeVisit.discount_percent}%</p>
                  </div>
                  <Badge className={officeVisit.status === "launched" ? "border-success/20 bg-success/10 text-success" : "border-warning/20 bg-warning/10 text-warning-foreground"}>
                    {officeVisit.status === "launched" ? "Lançamento concluído" : "Lançamento pendente"}
                  </Badge>
                </div>

                <div className="overflow-x-auto rounded-md border border-border bg-card">
                  <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                    <thead className="bg-muted text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Artigo</th>
                        <th className="px-4 py-3 font-semibold">Descrição</th>
                        <th className="px-4 py-3 font-semibold">Desc.</th>
                        <th className="px-4 py-3 font-semibold">UN</th>
                        <th className="px-4 py-3 font-semibold">Qtd.</th>
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
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 tabular-nums">{(100 * (1 - (1 - officeVisit.discount_percent / 100) * (1 - item.discount_percent / 100))).toLocaleString("pt-MZ", { maximumFractionDigits: 2 })}%</td>
                          <td className="whitespace-nowrap px-4 py-4">{item.unit}</td>
                          <td className="whitespace-nowrap px-4 py-4 font-semibold tabular-nums">{formatPrimaveraQuantity(item.quantity)}</td>
                          <td className="px-4 py-4">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              aria-label={`Copiar linha de ${item.product_name} para o Primavera`}
                              onClick={() => void handleCopy(getPrimaveraRow(item).join("\t"), "Linha formatada para colar no Primavera.")}
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
                description="Ainda não existem vistorias concluídas disponíveis para lançamento."
              />
            )}
            </>
            ) : null}
          </section>
        ) : null}

        {mode === "cadastro" ? (
          <section className="mx-auto max-w-4xl space-y-6">
            {!cadastroSection ? (
              <button type="button" onClick={() => setCadastroSection(true)} className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-6 text-left shadow-sm transition hover:border-brand-green hover:shadow-md">
                <span className="grid size-14 place-items-center rounded-xl bg-brand-green/15 text-brand-navy"><Building2 className="size-7" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><span className="block font-display text-xl font-semibold">Cadastro de empresas</span><span className="mt-1 block text-sm text-muted-foreground">Registar, editar, activar, desactivar ou eliminar empresas.</span></span>
                <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
              </button>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h2 className="font-display text-2xl font-semibold">Cadastro de empresas</h2><p className="mt-1 text-sm text-muted-foreground">Gira os nomes e o estado das empresas registadas.</p></div>
                  <Button type="button" variant="outline" onClick={() => { setCadastroSection(false); setEditingCompanyId(null); }}>Voltar</Button>
                </div>
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
                  <div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-xl bg-brand-green/15 text-brand-navy"><Building2 className="size-6" aria-hidden="true" /></span><div><h3 className="font-display text-xl font-semibold">Cadastrar nova empresa</h3><p className="mt-1 text-sm text-muted-foreground">As empresas activas ficam disponíveis para novas vistorias.</p></div></div>
                  <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); const name = companyName.trim(); if (name) createCompanyMutation.mutate(name); }}>
                    <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Nome da empresa" aria-label="Nome da empresa" className="h-12 bg-background" maxLength={120} />
                    <Button type="submit" disabled={!companyName.trim() || createCompanyMutation.isPending} className="h-12 shrink-0 bg-brand-green text-brand-green-foreground hover:bg-brand-green/90"><Plus aria-hidden="true" />{createCompanyMutation.isPending ? "A cadastrar…" : "Cadastrar empresa"}</Button>
                  </form>
                </div>
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
                  <div className="flex items-center justify-between gap-3 border-b border-border pb-4"><div><h3 className="font-display text-xl font-semibold">Empresas registadas</h3><p className="mt-1 text-sm text-muted-foreground">Edite os dados ou altere a disponibilidade de cada empresa.</p></div><Badge variant="secondary">{data.companies.length}</Badge></div>
                  <div className="divide-y divide-border">
                    {data.companies.length ? data.companies.map((company) => (
                      <div key={company.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                        {editingCompanyId === company.id ? (
                          <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_170px_auto]">
                            <Input value={editingCompanyName} onChange={(event) => setEditingCompanyName(event.target.value)} aria-label="Nome da empresa" maxLength={120} />
                            <Select value={editingCompanyActive ? "active" : "inactive"} onValueChange={(value) => setEditingCompanyActive(value === "active")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Activa</SelectItem><SelectItem value="inactive">Não activa</SelectItem></SelectContent></Select>
                            <div className="flex gap-2"><Button type="button" size="sm" disabled={!editingCompanyName.trim() || updateCompanyMutation.isPending} onClick={() => updateCompanyMutation.mutate({ id: company.id, name: editingCompanyName.trim(), active: editingCompanyActive })}>Guardar</Button><Button type="button" size="sm" variant="outline" onClick={() => setEditingCompanyId(null)}>Cancelar</Button></div>
                          </div>
                        ) : (
                          <><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-brand-navy"><Store className="size-5" aria-hidden="true" /></span><span className="min-w-0 flex-1 truncate text-sm font-medium">{company.name}</span><Badge variant={company.active ? "default" : "secondary"}>{company.active ? "Activa" : "Não activa"}</Badge><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => { setEditingCompanyId(company.id); setEditingCompanyName(company.name); setEditingCompanyActive(company.active); }}><Pencil className="size-4" aria-hidden="true" />Editar</Button><Button type="button" size="sm" variant="destructive" onClick={() => setCompanyToDelete({ id: company.id, name: company.name })}><Trash2 className="size-4" aria-hidden="true" />Eliminar</Button></div></>
                        )}
                      </div>
                    )) : <p className="py-8 text-center text-sm text-muted-foreground">Ainda não existem empresas cadastradas.</p>}
                  </div>
                </div>
              </>
            )}
          </section>
        ) : null}

        {mode === "history" ? (
          <section className="space-y-7">
            <div className="border-y border-border py-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Arquivo operacional</p>
                  <h2 className="mt-1 font-display text-xl font-semibold">Vistorias realizadas</h2>
                </div>
                <span className="text-sm text-muted-foreground">{historyVisits.length} registos</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <label className="grid gap-2 text-xs font-semibold uppercase text-muted-foreground">
                  Empresa
                  <Select value={historyStore} onValueChange={setHistoryStore}>
                    <SelectTrigger className="h-11 bg-card text-sm font-normal normal-case text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os supermercados</SelectItem>
                      {data.companies.map((company) => <SelectItem key={company.id} value={company.name}>{company.name}</SelectItem>)}
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
                <label className="grid gap-2 text-xs font-semibold uppercase text-muted-foreground">
                  Estado da vistoria
                  <Select value={historyStatus} onValueChange={(value) => setHistoryStatus(value as "all" | "pending" | "completed")}>
                    <SelectTrigger className="h-11 bg-card text-sm font-normal normal-case text-foreground"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="completed">Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full"
                    onClick={() => {
                      setHistoryStore("all");
                      setHistoryStatus("all");
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
                    <article key={visit.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(140px,0.7fr)_auto] sm:items-center">
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
                        <Badge className={pendingCount > 0 || visit.status === "in_progress" ? "border-warning/20 bg-warning/10 text-warning-foreground" : "border-success/20 bg-success/10 text-success"}>
                          {pendingCount > 0 || visit.status === "in_progress" ? "Pendente" : "Concluído"}
                        </Badge>
                        {pendingCount > 0 ? <span className="ml-2">{pendingCount} por lançar</span> : null}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        className="justify-self-start sm:justify-self-end"
                        onClick={() => {
                          setOfficeVisitId(visit.id);
                          setOfficeEntered(true);
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

      </div>

      {companyToDelete ? (
        <div className="no-print fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" role="alertdialog" aria-modal="true" aria-labelledby="delete-company-title">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h2 id="delete-company-title" className="font-display text-xl font-semibold">Eliminar empresa?</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Tem a certeza de que pretende eliminar <strong className="text-foreground">{companyToDelete.name}</strong>? Esta acção não pode ser desfeita.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" onClick={() => setCompanyToDelete(null)}>Cancelar</Button>
              <Button type="button" variant="destructive" disabled={deleteCompanyMutation.isPending} onClick={() => deleteCompanyMutation.mutate(companyToDelete.id)}>{deleteCompanyMutation.isPending ? "A eliminar…" : "Sim, eliminar"}</Button>
            </div>
          </div>
        </div>
      ) : null}

      {stockWarningProduct ? (
        <div className="no-print fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4" role="alertdialog" aria-modal="true" aria-labelledby="stock-warning-title">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-amber-500/10 text-amber-600"><Package className="size-7" aria-hidden="true" /></span>
            <h2 id="stock-warning-title" className="mt-4 text-center font-display text-xl font-semibold">Stock insuficiente</h2>
            <p className="mt-2 text-center text-sm leading-6 text-muted-foreground">O produto <strong className="text-foreground">{stockWarningProduct.name}</strong> tem {stockWarningProduct.stock} unidades disponíveis, mas está a solicitar {quantityText}. Deseja adicionar este produto mesmo assim?</p>
            <p className="mt-2 text-center text-xs text-muted-foreground">A quantidade registada na vistoria não altera nem desconta o stock do Primavera.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" onClick={() => setStockWarningProduct(null)}>Não adicionar</Button>
              <Button type="button" disabled={addItemMutation.isPending} onClick={confirmAddWithInsufficientStock} className="bg-brand-green text-brand-green-foreground hover:bg-brand-green/90">{addItemMutation.isPending ? "A adicionar…" : "Sim, adicionar"}</Button>
            </div>
          </div>
        </div>
      ) : null}

      {completionConfirmOpen ? (
        <div className="no-print fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4" role="alertdialog" aria-modal="true" aria-labelledby="completion-confirm-title">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h2 id="completion-confirm-title" className="font-display text-xl font-semibold">Concluir vistoria?</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Tem a certeza de que pretende finalizar esta vistoria? Depois de concluir, poderá consultar o relatório no Escritório.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" onClick={() => setCompletionConfirmOpen(false)}>Cancelar</Button>
              <Button type="button" disabled={completeVisitMutation.isPending} onClick={() => { if (activeVisit) completeVisitMutation.mutate(activeVisit.id); setCompletionConfirmOpen(false); }} className="bg-brand-green text-brand-green-foreground hover:bg-brand-green/90">Sim, concluir</Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
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
