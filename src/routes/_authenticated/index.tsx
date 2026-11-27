import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Company = Tables<"companies">;
type Product = Tables<"products">;
type Brand = Tables<"brands">;
type Category = Tables<"product_categories">;
type Family = Tables<"product_families">;
type Order = Tables<"orders">;
type OrderItem = Tables<"order_items">;
type DailyRoute = Tables<"daily_routes">;
type RouteVisit = Tables<"route_visits">;
type AppUser = { id: string; username: string; isAdmin: boolean; active: boolean; createdAt: string };
type Page = "home" | "dashboard" | "orders" | "routes" | "catalog" | "companies" | "users" | "history";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [
    { title: "Maxi Armazém | Encomendas e Rotas" },
    { name: "description", content: "Gestão de encomendas, catálogo e rotas da equipa Maxi Armazém." },
    { property: "og:title", content: "Maxi Armazém | Encomendas e Rotas" },
    { property: "og:description", content: "Gestão de encomendas, catálogo e rotas da equipa Maxi Armazém." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Workspace,
});

function Workspace() {
  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("Utilizador");
  const [isAdmin, setIsAdmin] = useState(false);
  const [page, setPage] = useState<Page>("home");
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [routes, setRoutes] = useState<DailyRoute[]>([]);
  const [routeVisits, setRouteVisits] = useState<RouteVisit[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [familyFilter, setFamilyFilter] = useState("all");
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [catalogView, setCatalogView] = useState<"grid" | "list">("grid");
  const [productSort, setProductSort] = useState("name");
  const [companyId, setCompanyId] = useState("");
  const [busy, setBusy] = useState(false);
  const [routeDate, setRouteDate] = useState(new Date().toISOString().slice(0, 10));
  const [assignedUser, setAssignedUser] = useState("");
  const [routeCompanyIds, setRouteCompanyIds] = useState<string[]>([]);
  const [newCompany, setNewCompany] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newFamily, setNewFamily] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [familyCategory, setFamilyCategory] = useState("");
  const [familyBrand, setFamilyBrand] = useState("");
  const [productForm, setProductForm] = useState({ code: "", name: "", description: "", unit: "UN", brand_id: "", category_id: "", family_id: "", image_url: "" });
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newUserAdmin, setNewUserAdmin] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [historyFilter, setHistoryFilter] = useState("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { window.location.assign("/auth"); return; }
      setUserId(auth.user.id);
      const [profileRes, rolesRes, companiesRes, productsRes, brandsRes, familiesRes, categoriesRes, ordersRes, itemsRes, routesRes, routeVisitsRes] = await Promise.all([
        supabase.from("user_profiles").select("username").eq("user_id", auth.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", auth.user.id),
        supabase.from("companies").select("*").order("name"),
        supabase.from("products").select("*").order("sort_order").order("name"),
        supabase.from("brands").select("*").order("name"),
        supabase.from("product_families").select("*").order("name"),
        supabase.from("product_categories").select("*").order("name"),
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("order_items").select("*").order("created_at"),
        supabase.from("daily_routes").select("*").order("route_date", { ascending: false }),
        supabase.from("route_visits").select("*").order("position"),
      ]);
      const firstError = [profileRes.error, rolesRes.error, companiesRes.error, productsRes.error, brandsRes.error, familiesRes.error, categoriesRes.error, ordersRes.error, itemsRes.error, routesRes.error, routeVisitsRes.error].find(Boolean);
      if (firstError) throw firstError;
      const admin = (rolesRes.data ?? []).some((r) => r.role === "admin");
      setIsAdmin(admin);
      if (!initialized.current) { setPage("home"); initialized.current = true; }
      setUsername(profileRes.data?.username ?? String(auth.user.user_metadata?.["username"] ?? "Utilizador"));
      setCompanies(companiesRes.data ?? []);
      setProducts(productsRes.data ?? []);
      setBrands(brandsRes.data ?? []);
      setFamilies(familiesRes.data ?? []);
      setCategories(categoriesRes.data ?? []);
      setOrders(ordersRes.data ?? []);
      setOrderItems(itemsRes.data ?? []);
      setRoutes(routesRes.data ?? []);
      setRouteVisits(routeVisitsRes.data ?? []);
      if (admin) {
        const { data: userData, error: userError } = await supabase.functions.invoke<{ users: AppUser[] }>("manage-users", { body: { action: "list" } });
        if (userError) throw userError;
        setUsers(userData?.users ?? []);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar os dados.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const activeCompanies = companies.filter((company) => company.active);
  const filteredProducts = useMemo(() => products.filter((product) => {
    const term = search.trim().toLocaleLowerCase("pt-MZ");
    return product.active &&
      (!term || `${product.code} ${product.name} ${product.description ?? ""}`.toLocaleLowerCase("pt-MZ").includes(term)) &&
      (brandFilter === "all" || product.brand_id === brandFilter) &&
      (familyFilter === "all" || product.family_id === familyFilter) &&
      (categoryFilter === "all" || product.category_id === categoryFilter);
  }), [products, search, brandFilter, familyFilter, categoryFilter]);

  function addToCart(product: Product) {
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      return existing
        ? current.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { product, quantity: 1 }];
    });
    toast.success("Produto adicionado ao carrinho.");
  }

  async function finalizeOrder() {
    if (!companyId) { toast.error("Seleccione a empresa da encomenda."); return; }
    if (!cart.length) { toast.error("Adicione pelo menos um produto."); return; }
    setBusy(true);
    let draftOrderId: string | null = null;
    try {
      const { data: order, error } = await supabase.from("orders").insert({ company_id: companyId, created_by: userId, status: "draft" }).select().single();
      if (error) throw error;
      draftOrderId = order.id;
      const rows = cart.map(({ product, quantity }) => ({ order_id: order.id, product_id: product.id, product_code: product.code, product_name: product.name, unit: product.unit, quantity }));
      const { error: itemsError } = await supabase.from("order_items").insert(rows);
      if (itemsError) throw itemsError;
      const { error: submitError } = await supabase.from("orders").update({ status: "submitted" }).eq("id", order.id);
      if (submitError) throw submitError;
      draftOrderId = null;
      setCart([]); setCompanyId(""); setCartOpen(false); setPage("history");
      toast.success("Encomenda guardada com sucesso.");
      await loadData();
    } catch (error) {
      if (draftOrderId) await supabase.from("orders").delete().eq("id", draftOrderId);
      toast.error(error instanceof Error ? error.message : "Não foi possível finalizar a encomenda.");
      await loadData();
    } finally { setBusy(false); }
  }

  async function exportOrder(order: Order) {
    const company = companies.find((entry) => entry.id === order.company_id);
    const items = orderItems.filter((item) => item.order_id === order.id);
    const headers = ["Artigo", "Arm.", "Localização", "Lote", "Descrição", "CIVA", "IVA", "Pr. Unit.", "Desc.", "UN", "Qtd.", "Total Liq.", "Contrato"];
    const rows = [headers, ...items.map(item => [
      item.product_code, "", "", "", item.product_name, "", "", "", "", item.unit,
      Number(item.quantity.toFixed(2)), "", "",
    ])];
    const blob = buildXlsx(rows);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Encomenda-${company?.name ?? "Maxi"}-${order.created_at.slice(0, 10)}.xlsx`.replace(/[^a-zA-Z0-9._-]/g, "_");
    link.click();
    URL.revokeObjectURL(url);
  }

  async function createRoute() {
    if (!assignedUser || !routeCompanyIds.length) { toast.error("Escolha o responsável e pelo menos uma empresa."); return; }
    setBusy(true);
    try {
      const { data: route, error } = await supabase.from("daily_routes").insert({ route_date: routeDate, assigned_user_id: assignedUser, created_by: userId }).select().single();
      if (error) throw error;
      const { error: visitsError } = await supabase.from("route_visits").insert(routeCompanyIds.map((id, index) => ({ route_id: route.id, company_id: id, position: index })));
      if (visitsError) throw visitsError;
      setRouteCompanyIds([]);
      toast.success("Rota diária atribuída.");
      await loadData();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível criar a rota."); }
    finally { setBusy(false); }
  }

  async function updateRouteVisit(visit: RouteVisit, status: RouteVisit["status"]) {
    const now = new Date().toISOString();
    const { error } = await supabase.from("route_visits").update({
      status,
      started_at: status === "in_progress" ? (visit.started_at ?? now) : visit.started_at,
      completed_at: status === "completed" ? now : status === "not_visited" ? now : null,
      updated_at: now,
    }).eq("id", visit.id);
    if (error) toast.error(error.message); else { toast.success("Estado da visita actualizado."); await loadData(); }
  }

  async function addCompany() {
    if (!newCompany.trim()) return;
    const { error } = await supabase.from("companies").insert({ name: newCompany.trim() });
    if (error) toast.error(error.message); else { setNewCompany(""); await loadData(); toast.success("Empresa cadastrada."); }
  }

  async function toggleCompany(company: Company) {
    const { error } = await supabase.from("companies").update({ active: !company.active }).eq("id", company.id);
    if (error) toast.error(error.message); else await loadData();
  }

  async function addBrand() {
    if (!newBrand.trim()) return;
    const { error } = await supabase.from("brands").insert({ name: newBrand.trim() });
    if (error) toast.error(error.message); else { setNewBrand(""); await loadData(); }
  }

  async function addCategory() {
    if (!newCategory.trim()) return;
    const { error } = await supabase.from("product_categories").insert({ name: newCategory.trim() });
    if (error) toast.error(error.message); else { setNewCategory(""); await loadData(); }
  }

  async function addFamily() {
    if (!newFamily.trim()) return;
    const { error } = await supabase.from("product_families").insert({ name: newFamily.trim(), brand_id: familyBrand || null, category_id: familyCategory || null });
    if (error) toast.error(error.message); else { setNewFamily(""); await loadData(); }
  }

  async function addProduct(event: FormEvent) {
    event.preventDefault();
    const { error } = await supabase.from("products").insert({
      ...productForm, brand_id: productForm.brand_id || null, category_id: productForm.category_id || null, family_id: productForm.family_id || null,
      image_url: productForm.image_url || null, description: productForm.description || null,
    });
    if (error) toast.error(error.message); else {
      setProductForm({ code: "", name: "", description: "", unit: "UN", brand_id: "", category_id: "", family_id: "", image_url: "" });
      await loadData(); toast.success("Produto adicionado ao catálogo.");
    }
  }

  async function toggleProduct(product: Product) {
    const { error } = await supabase.from("products").update({ active: !product.active }).eq("id", product.id);
    if (error) toast.error(error.message); else await loadData();
  }

  async function updateOrderStatus(order: Order, status: Order["status"]) {
    const { error } = await supabase.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", order.id);
    if (error) toast.error(error.message); else { toast.success("Estado da encomenda actualizado."); await loadData(); }
  }

  async function saveUser(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = editingUser
        ? { action: "update", userId: editingUser.id, username: editingUser.username, isAdmin: editingUser.isAdmin, active: editingUser.active }
        : { action: "create", username: newUsername, password: newPassword, isAdmin: newUserAdmin };
      const { error } = await supabase.functions.invoke("manage-users", { body: payload });
      if (error) throw error;
      setEditingUser(null); setNewUsername(""); setNewPassword(""); setNewUserAdmin(false);
      await loadData(); toast.success(editingUser ? "Conta actualizada." : "Conta criada.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível guardar a conta."); }
    finally { setBusy(false); }
  }

  const visibleOrders = orders.filter((order) => isAdmin || order.created_by === userId);
  const reportOrders = visibleOrders.filter((order) => historyFilter === "all" || order.status === historyFilter);
  const nav: { id: Page; label: string }[] = isAdmin
    ? [{ id: "dashboard", label: "Painel de controlo" }, { id: "orders", label: "Encomendas" }, { id: "routes", label: "Rotas" }, { id: "catalog", label: "Produtos e famílias" }, { id: "companies", label: "Empresas" }, { id: "users", label: "Utilizadores" }, { id: "history", label: "Histórico e relatórios" }]
    : [{ id: "orders", label: "Encomendas" }, { id: "routes", label: "Rotas" }, { id: "history", label: "Histórico" }];

  if (loading) return <main className="grid min-h-screen place-items-center bg-slate-50 text-slate-600">A carregar Maxi Armazém…</main>;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-700">Maxi Armazém</p><h1 className="text-xl font-bold">Gestão de Encomendas e Rotas</h1></div>
          <div className="flex items-center gap-3 text-sm"><span className="rounded-full bg-slate-100 px-3 py-2">{username} · {isAdmin ? "Administrador" : "Utilizador"}</span><button className="rounded-lg border px-3 py-2 hover:bg-slate-50" onClick={() => void supabase.auth.signOut().then(() => window.location.assign("/auth"))}>Sair</button></div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <section className="min-w-0">
          {page !== "home" && <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><button onClick={() => setPage("home")} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">← Menu principal</button><span className="text-sm text-slate-500">{username} · {isAdmin ? "Administrador" : "Utilizador"}</span></div>}
          {page === "home" && <div className="mx-auto max-w-5xl py-8"><div className="mb-8 text-center"><h2 className="text-3xl font-bold tracking-tight">Menu principal</h2><p className="mt-2 text-slate-500">Seleccione a área que pretende abrir.</p></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{nav.map((item) => <button key={item.id} onClick={() => setPage(item.id)} className="group flex min-h-44 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm transition hover:-translate-y-1 hover:border-emerald-600 hover:shadow-md"><span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-2xl font-bold text-emerald-700">{({dashboard:"▦",orders:"▤",routes:"⌖",catalog:"▧",companies:"⌂",users:"♙",history:"◷"} as Record<string,string>)[item.id]}</span><span className="text-lg font-semibold text-slate-900">{item.label}</span><span className="mt-2 text-sm text-slate-500">Abrir secção</span></button>)}</div></div>}
          {page === "dashboard" && isAdmin && <div className="space-y-5"><h2 className="text-2xl font-bold">Painel de controlo</h2><div className="grid gap-4 sm:grid-cols-3"><Metric label="Encomendas" value={orders.length}/><Metric label="Produtos activos" value={products.filter(p=>p.active).length}/><Metric label="Empresas activas" value={activeCompanies.length}/></div><div className="rounded-2xl border bg-white p-5"><h3 className="font-semibold">Operação</h3><p className="mt-2 text-sm text-slate-600">Acompanhe encomendas, atribua rotas diárias e mantenha o catálogo actualizado.</p></div></div>}

          {page === "orders" && <div className="space-y-5">
            {isAdmin && <div className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Encomendas recebidas</h3><div className="mt-3 divide-y">{orders.filter(o=>o.status!=="completed"&&o.status!=="cancelled").map(order=><div key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{companies.find(c=>c.id===order.company_id)?.name ?? "Empresa"}</p><p className="text-xs text-slate-500">{new Date(order.created_at).toLocaleString("pt-MZ")} · {users.find(u=>u.id===order.created_by)?.username ?? (order.created_by===userId?username:"Utilizador")} · {orderItems.filter(i=>i.order_id===order.id).length} produtos</p></div><select className="rounded-lg border px-3 py-2 text-sm" value={order.status} onChange={e=>void updateOrderStatus(order,e.target.value as Order["status"])}><option value="draft">Rascunho</option><option value="submitted">Submetida</option><option value="processing">Em processamento</option><option value="completed">Concluída</option><option value="cancelled">Cancelada</option></select></div>)}{!orders.some(o=>o.status!=="completed"&&o.status!=="cancelled")&&<p className="py-4 text-sm text-slate-500">Não existem encomendas pendentes.</p>}</div></div>}
            <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-2xl font-bold">Encomendas</h2><p className="text-sm text-slate-500">Escolha os produtos e adicione-os ao carrinho para finalizar.</p></div><button onClick={()=>setCartOpen(true)} className="relative inline-flex items-center gap-3 rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white shadow-sm hover:bg-emerald-800"><span className="text-xl">🛒</span><span>Carrinho</span><span className="rounded-full bg-white px-2 py-0.5 text-sm font-bold text-emerald-800">{cart.reduce((sum,item)=>sum+item.quantity,0)}</span></button></div>
            <div className="rounded-2xl border bg-white p-3 shadow-sm"><div className="relative"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span><input className="w-full rounded-xl border-0 bg-slate-50 py-3 pl-11 pr-4 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-600" placeholder="Pesquisar produto (nome, código ou referência)" value={search} onChange={e=>setSearch(e.target.value)}/></div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1"><button onClick={()=>setBrandFilter("all")} className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold ${brandFilter==="all"?"bg-emerald-700 text-white":"bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>Todos</button>{brands.filter(brand=>products.some(product=>product.active&&product.brand_id===brand.id)).map(brand=><button key={brand.id} onClick={()=>setBrandFilter(brand.id)} className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold ${brandFilter===brand.id?"bg-emerald-700 text-white":"bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{brand.name}</button>)}</div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500"><strong className="text-slate-800">{filteredProducts.length}</strong> produtos</p><div className="flex items-center gap-2"><label className="text-sm text-slate-500">Ordenar por:</label><select className="rounded-lg border bg-white px-3 py-2 text-sm" value={productSort} onChange={e=>setProductSort(e.target.value)}><option value="name">Nome</option><option value="code">Código</option></select><div className="flex rounded-lg border bg-white p-1"><button aria-label="Vista em grelha" title="Grelha" onClick={()=>setCatalogView("grid")} className={`rounded-md px-3 py-1.5 ${catalogView==="grid"?"bg-emerald-100 text-emerald-800":"text-slate-500"}`}>▦</button><button aria-label="Vista em lista" title="Lista" onClick={()=>setCatalogView("list")} className={`rounded-md px-3 py-1.5 ${catalogView==="list"?"bg-emerald-100 text-emerald-800":"text-slate-500"}`}>☰</button></div></div></div>
            <div className={catalogView==="grid"?"grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4":"space-y-3"}>{[...filteredProducts].sort((a,b)=>productSort==="code"?a.code.localeCompare(b.code,"pt"):a.name.localeCompare(b.name,"pt")).map(product=>{const selected=cart.find(item=>item.product.id===product.id);return <article key={product.id} className={`relative overflow-hidden rounded-2xl border bg-white transition hover:border-emerald-300 hover:shadow-sm ${selected?"border-emerald-600 ring-1 ring-emerald-100":""} ${catalogView==="list"?"flex items-center gap-3 p-3":""}`}>{selected&&<span className="absolute right-2 top-2 z-10 grid size-6 place-items-center rounded-full bg-emerald-700 text-sm font-bold text-white">✓</span>}<div className={catalogView==="grid"?"grid h-32 place-items-center bg-slate-50 p-2 sm:h-40":"grid size-24 shrink-0 place-items-center rounded-xl bg-slate-50 p-2"}>{product.image_url?<img src={product.image_url} alt={product.name} className="h-full w-full object-contain"/>:<span className="text-4xl">📦</span>}</div><div className={catalogView==="grid"?"space-y-2 p-3":"min-w-0 flex-1 space-y-1"}><p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Cód.: {product.code}</p><h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{product.name}</h3><p className="text-xs text-slate-500">{brands.find(b=>b.id===product.brand_id)?.name??"Sem marca"} · {product.unit}</p><div className={catalogView==="grid"?"mt-3 flex items-center justify-between rounded-lg border bg-slate-50 p-1":"mt-2 flex w-fit items-center gap-3 rounded-lg border bg-slate-50 p-1"}><button aria-label={`Diminuir ${product.name}`} disabled={!selected} onClick={()=>setCart(current=>current.map(item=>item.product.id===product.id?{...item,quantity:Math.max(0,item.quantity-1)}:item).filter(item=>item.quantity>0))} className="grid size-7 place-items-center rounded-md bg-white text-lg disabled:opacity-30">−</button><span className="min-w-6 text-center text-sm font-semibold">{selected?.quantity??0}</span><button aria-label={`Adicionar ${product.name}`} onClick={()=>addToCart(product)} className="grid size-7 place-items-center rounded-md bg-emerald-700 text-lg text-white">+</button></div></div></article>})}</div>
            {!filteredProducts.length&&<Empty text="Não existem produtos activos para esta pesquisa ou categoria."/>}
            {cartOpen&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 sm:p-6" onClick={()=>setCartOpen(false)}><section role="dialog" aria-modal="true" aria-labelledby="cart-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between gap-3 border-b pb-4"><div><h3 id="cart-title" className="text-xl font-bold">O seu carrinho</h3><p className="text-sm text-slate-500">{cart.length} produtos · {cart.reduce((sum,item)=>sum+item.quantity,0)} unidades</p></div><button aria-label="Fechar carrinho" onClick={()=>setCartOpen(false)} className="grid size-9 place-items-center rounded-full bg-slate-100 text-xl">×</button></div><div className="divide-y">{cart.map(({product,quantity})=><div key={product.id} className="flex items-center gap-3 py-4"><div className="grid size-16 shrink-0 place-items-center rounded-xl bg-slate-50 p-1">{product.image_url?<img src={product.image_url} alt="" className="h-full w-full object-contain"/>:<span className="text-2xl">📦</span>}</div><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{product.name}</p><p className="text-xs text-slate-500">{product.code} · {product.unit}</p><div className="mt-2 flex items-center gap-2"><button onClick={()=>setCart(c=>c.map(i=>i.product.id===product.id?{...i,quantity:Math.max(0,i.quantity-1)}:i).filter(i=>i.quantity>0))} className="size-7 rounded-lg border">−</button><span className="min-w-5 text-center text-sm font-semibold">{quantity}</span><button onClick={()=>setCart(c=>c.map(i=>i.product.id===product.id?{...i,quantity:i.quantity+1}:i))} className="size-7 rounded-lg border">+</button></div></div><button onClick={()=>setCart(c=>c.filter(i=>i.product.id!==product.id))} className="text-xs font-semibold text-red-600">Remover</button></div>)}</div>{!cart.length&&<p className="py-8 text-center text-sm text-slate-500">O carrinho está vazio. Adicione produtos ao catálogo para continuar.</p>}<label className="mt-4 block text-sm font-semibold">Empresa<select className="mt-2 w-full rounded-xl border bg-white px-3 py-3 font-normal" value={companyId} onChange={e=>setCompanyId(e.target.value)}><option value="">Seleccionar empresa</option>{activeCompanies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><button onClick={()=>setCartOpen(false)} className="rounded-xl border px-4 py-3 text-sm font-semibold">Continuar a escolher produtos</button><button disabled={busy||!cart.length} onClick={()=>void finalizeOrder()} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy?"A guardar…":"Confirmar e finalizar encomenda"}</button></div></section></div>}
          </div>}

          {page === "routes" && <div className="space-y-5"><div><h2 className="text-2xl font-bold">Rotas por dia</h2><p className="text-sm text-slate-500">As empresas são atribuídas pelo administrador. O utilizador acompanha e actualiza as visitas.</p></div><div className="rounded-2xl border bg-white p-4"><label className="text-sm font-semibold">Data da rota<input type="date" className="ml-3 rounded-lg border px-3 py-2 font-normal" value={routeDate} onChange={e=>setRouteDate(e.target.value)}/></label></div>
            {isAdmin && <div className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Atribuir rota diária</h3><div className="mt-3 grid gap-3 md:grid-cols-2"><select className="rounded-xl border px-3 py-3" value={assignedUser} onChange={e=>setAssignedUser(e.target.value)}><option value="">Seleccionar responsável</option>{users.filter(u=>u.active&&!u.isAdmin).map(u=><option key={u.id} value={u.id}>{u.username}</option>)}</select><p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600">Seleccione as empresas pela ordem em que devem ser visitadas.</p></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{activeCompanies.map(c=><label key={c.id} className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={routeCompanyIds.includes(c.id)} onChange={e=>setRouteCompanyIds(current=>e.target.checked?[...current,c.id]:current.filter(id=>id!==c.id))}/>{c.name}</label>)}</div><button disabled={busy} onClick={()=>void createRoute()} className="mt-4 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">Guardar rota</button></div>}
            {routes.filter(r=>r.route_date===routeDate&&(isAdmin||r.assigned_user_id===userId)).map(route=><div key={route.id} className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">Rota de {route.route_date}</h3><span className="text-xs text-slate-500">Responsável: {users.find(u=>u.id===route.assigned_user_id)?.username ?? (route.assigned_user_id===userId?username:"Utilizador atribuído")}</span></div><div className="mt-4 space-y-3">{routeVisits.filter(v=>v.route_id===route.id).sort((a,b)=>a.position-b.position).map((visit,index)=><div key={visit.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><p className="text-xs text-slate-400">Paragem {index+1}</p><p className="font-semibold">{companies.find(c=>c.id===visit.company_id)?.name ?? "Empresa"}</p><p className="text-xs text-slate-500">{routeStatus(visit.status)}</p></div>{(isAdmin||route.assigned_user_id===userId)&&<select className="rounded-lg border px-3 py-2 text-sm" value={visit.status} onChange={e=>void updateRouteVisit(visit,e.target.value as RouteVisit["status"])}><option value="planned">Planeada</option><option value="in_progress">Em curso</option><option value="completed">Concluída</option><option value="not_visited">Não realizada</option></select>}</div>)}</div></div>)}
            {!routes.some(r=>r.route_date===routeDate&&(isAdmin||r.assigned_user_id===userId))&&<Empty text="Não existe uma rota atribuída para esta data."/>}</div>}

          {page === "catalog" && isAdmin && <div className="space-y-5"><h2 className="text-2xl font-bold">Produtos e famílias</h2><div className="grid gap-4 lg:grid-cols-3"><div className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Categorias / tipos</h3><div className="mt-3 flex gap-2"><input className="min-w-0 flex-1 rounded-xl border px-3 py-2" placeholder="Nome da categoria" value={newCategory} onChange={e=>setNewCategory(e.target.value)}/><button onClick={()=>void addCategory()} className="rounded-xl bg-emerald-700 px-4 text-white">Adicionar</button></div><div className="mt-3 flex flex-wrap gap-2">{categories.map(category=><span key={category.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm">{category.name}</span>)}</div></div><div className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Marcas</h3><div className="mt-3 flex gap-2"><input className="min-w-0 flex-1 rounded-xl border px-3 py-2" placeholder="Nome da marca" value={newBrand} onChange={e=>setNewBrand(e.target.value)}/><button onClick={()=>void addBrand()} className="rounded-xl bg-emerald-700 px-4 text-white">Adicionar</button></div><div className="mt-3 flex flex-wrap gap-2">{brands.map(b=><span key={b.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm">{b.name}</span>)}</div></div><div className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Famílias</h3><div className="mt-3 grid gap-2"><input className="rounded-xl border px-3 py-2" placeholder="Nome da família" value={newFamily} onChange={e=>setNewFamily(e.target.value)}/><select className="rounded-xl border px-3 py-2" value={familyCategory} onChange={e=>setFamilyCategory(e.target.value)}><option value="">Sem categoria associada</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select><select className="rounded-xl border px-3 py-2" value={familyBrand} onChange={e=>setFamilyBrand(e.target.value)}><option value="">Sem marca associada</option>{brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><button onClick={()=>void addFamily()} className="rounded-xl bg-emerald-700 px-4 py-2 text-white">Adicionar família</button></div><div className="mt-3 flex flex-wrap gap-2">{families.map(f=><span key={f.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm">{f.name}</span>)}</div></div></div>
            <form onSubmit={addProduct} className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Cadastrar produto</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><input required className="rounded-xl border px-3 py-3" placeholder="Código / Artigo" value={productForm.code} onChange={e=>setProductForm(p=>({...p,code:e.target.value}))}/><input required className="rounded-xl border px-3 py-3" placeholder="Nome do produto" value={productForm.name} onChange={e=>setProductForm(p=>({...p,name:e.target.value}))}/><input className="rounded-xl border px-3 py-3" placeholder="Descrição adicional" value={productForm.description} onChange={e=>setProductForm(p=>({...p,description:e.target.value}))}/><input className="rounded-xl border px-3 py-3" placeholder="Unidade (ex.: UN)" value={productForm.unit} onChange={e=>setProductForm(p=>({...p,unit:e.target.value}))}/><select className="rounded-xl border px-3 py-3" value={productForm.category_id} onChange={e=>setProductForm(p=>({...p,category_id:e.target.value}))}><option value="">Seleccionar categoria / tipo</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select><select className="rounded-xl border px-3 py-3" value={productForm.brand_id} onChange={e=>setProductForm(p=>({...p,brand_id:e.target.value}))}><option value="">Seleccionar marca</option>{brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><select className="rounded-xl border px-3 py-3" value={productForm.family_id} onChange={e=>setProductForm(p=>({...p,family_id:e.target.value}))}><option value="">Seleccionar família</option>{families.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select><input className="rounded-xl border px-3 py-3 sm:col-span-2" placeholder="URL da imagem (opcional)" value={productForm.image_url} onChange={e=>setProductForm(p=>({...p,image_url:e.target.value}))}/></div><button className="mt-4 rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white">Guardar produto</button></form>
            <div className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Catálogo ({products.length})</h3><div className="mt-3 divide-y">{products.map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{p.name}</p><p className="text-xs text-slate-500">{p.code} · {p.unit}</p></div><button onClick={()=>void toggleProduct(p)} className="rounded-lg border px-3 py-2 text-sm">{p.active?"Desactivar":"Activar"}</button></div>)}</div></div></div>}

          {page === "companies" && isAdmin && <div className="space-y-5"><h2 className="text-2xl font-bold">Empresas</h2><div className="flex gap-2 rounded-2xl border bg-white p-4"><input className="min-w-0 flex-1 rounded-xl border px-3 py-3" placeholder="Nome da empresa" value={newCompany} onChange={e=>setNewCompany(e.target.value)}/><button onClick={()=>void addCompany()} className="rounded-xl bg-emerald-700 px-4 text-white">Cadastrar</button></div><div className="rounded-2xl border bg-white p-4 divide-y">{companies.map(c=><div key={c.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-semibold">{c.name}</p><p className="text-xs text-slate-500">{c.active?"Activa":"Inactiva"}</p></div><button onClick={()=>void toggleCompany(c)} className="rounded-lg border px-3 py-2 text-sm">{c.active?"Desactivar":"Activar"}</button></div>)}</div></div>}

          {page === "users" && isAdmin && <div className="space-y-5"><h2 className="text-2xl font-bold">Utilizadores</h2><form onSubmit={saveUser} className="grid gap-3 rounded-2xl border bg-white p-5 md:grid-cols-4"><input required minLength={3} maxLength={40} className="rounded-xl border px-3 py-3" placeholder="Nome de utilizador" value={editingUser?.username ?? newUsername} onChange={e=>editingUser?setEditingUser({...editingUser,username:e.target.value}):setNewUsername(e.target.value)}/>{!editingUser&&<input required minLength={8} type="password" className="rounded-xl border px-3 py-3" placeholder="Palavra-passe inicial" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/>}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editingUser?.isAdmin ?? newUserAdmin} onChange={e=>editingUser?setEditingUser({...editingUser,isAdmin:e.target.checked}):setNewUserAdmin(e.target.checked)}/> Acesso administrativo</label>{editingUser&&<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editingUser.active} onChange={e=>setEditingUser({...editingUser,active:e.target.checked})}/> Conta activa</label>}<div className="flex gap-2"><button disabled={busy} className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">{editingUser?"Guardar alterações":"Criar utilizador"}</button>{editingUser&&<button type="button" onClick={()=>setEditingUser(null)} className="rounded-xl border px-4 py-3 text-sm">Cancelar</button>}</div></form><div className="rounded-2xl border bg-white p-4 divide-y">{users.map(u=><div key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{u.username}</p><p className="text-xs text-slate-500">{u.isAdmin?"Administrador":"Utilizador"} · {u.active?"Activo":"Desactivado"}</p></div><button onClick={()=>setEditingUser(u)} className="rounded-lg border px-3 py-2 text-sm">Editar</button></div>)}</div></div>}

          {page === "history" && <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">{isAdmin?"Histórico e relatórios":"Histórico"}</h2><p className="text-sm text-slate-500">{isAdmin?"Consulte todas as encomendas do sistema.":"Consulte as suas encomendas anteriores."}</p></div><select className="rounded-xl border bg-white px-3 py-2" value={historyFilter} onChange={e=>setHistoryFilter(e.target.value)}><option value="all">Todos os estados</option><option value="submitted">Submetida</option><option value="processing">Em processamento</option><option value="completed">Concluída</option><option value="cancelled">Cancelada</option></select></div><div className="space-y-3">{reportOrders.map(order=><article key={order.id} className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold">{companies.find(c=>c.id===order.company_id)?.name ?? "Empresa"}</p><p className="text-xs text-slate-500">{new Date(order.created_at).toLocaleString("pt-MZ")} · {orderItems.filter(i=>i.order_id===order.id).length} produtos</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{order.status}</span><button onClick={()=>void exportOrder(order)} className="rounded-lg border px-3 py-2 text-sm font-semibold">Exportar Excel</button></div></div><div className="mt-3 divide-y">{orderItems.filter(i=>i.order_id===order.id).map(item=><div key={item.id} className="flex justify-between gap-3 py-2 text-sm"><span>{item.product_code} · {item.product_name}</span><span className="font-semibold">{item.quantity.toFixed(2).replace(".",",")} {item.unit}</span></div>)}</div></article>)}{!reportOrders.length&&<Empty text="Ainda não existem encomendas neste histórico."/>}</div></div>}
        </section>
      </div>
    </main>
  );
}

function Metric({label,value}:{label:string;value:number}) { return <div className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>; }
function Empty({text}:{text:string}) { return <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-slate-500">{text}</div>; }
function routeStatus(status: RouteVisit["status"]) { return ({ planned: "Planeada", in_progress: "Em curso", completed: "Concluída", not_visited: "Não realizada" } as Record<string,string>)[status] ?? status; }

function buildXlsx(rows: (string | number)[][]): Blob {
  const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const col = (index: number) => { let n = index + 1, out = ""; while (n) { const rem = (n - 1) % 26; out = String.fromCharCode(65 + rem) + out; n = Math.floor((n - 1) / 26); } return out; };
  const sheetRows = rows.map((row, ri) => {
    const cells = row.map((value, ci) => {
      const ref = `${col(ci)}${ri + 1}`;
      if (typeof value === "number") return `<c r="${ref}"${ci === 10 && ri > 0 ? ' s="1"' : ""}><v>${value}</v></c>`;
      if (value === "") return "";
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
    }).join("");
    return `<row r="${ri + 1}">${cells}</row>`;
  }).join("");
  const files: Record<string, string> = {
    "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    "_rels/.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Encomenda" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    "xl/styles.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
  };
  const encoder = new TextEncoder();
  const crc32 = (data: Uint8Array) => {
    let crc = 0xffffffff;
    for (const byte of data) { crc ^= byte; for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const local: Uint8Array<ArrayBuffer>[] = [], central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;
  for (const [name, value] of Object.entries(files)) {
    const filename = encoder.encode(name), data = encoder.encode(value), crc = crc32(data);
    const lh = new Uint8Array(30 + filename.length + data.length), lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x800, true); lv.setUint16(8, 0, true);
    lv.setUint16(12, 0x21, true); lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, filename.length, true);
    lh.set(filename, 30); lh.set(data, 30 + filename.length); local.push(lh);
    const ch = new Uint8Array(46 + filename.length), cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x800, true); cv.setUint16(10, 0, true);
    cv.setUint16(14, 0x21, true); cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, filename.length, true); cv.setUint32(42, offset, true);
    ch.set(filename, 46); central.push(ch); offset += lh.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, central.length, true); ev.setUint16(10, central.length, true);
  ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  return new Blob([...local, ...central, end], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
