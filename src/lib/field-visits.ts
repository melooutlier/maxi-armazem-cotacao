import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Visit = Tables<"visits">;
export type VisitItem = Tables<"visit_items">;

export const SUPERMARKETS = [
  "VIP Spar Sommerschield",
  "Supermercado Recheio Maputo",
  "Premier Supermercado Malhangalene",
  "Supermercado Laranjinha Polana",
] as const;

export const PRIORITIES = ["Urgente", "Normal", "Baixa"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const QUANTITY_PRESETS = [1, 5, 10, 50] as const;
export const BOX_STEP = 1;

export interface CatalogProduct {
  code: string;
  name: string;
  category: string;
  unit: string;
}

export const PRODUCT_CATALOG: CatalogProduct[] = [
  { code: "GRA-001", name: "Arroz Cigala 5kg", category: "Grãos & Farinhas", unit: "saco" },
  { code: "GRA-002", name: "Arroz Mariana 1kg", category: "Grãos & Farinhas", unit: "pacote" },
  { code: "GRA-003", name: "Farinha Nacional Trigo 1kg", category: "Grãos & Farinhas", unit: "pacote" },
  { code: "GRA-004", name: "Farinha de Milho Chimoio 1kg", category: "Grãos & Farinhas", unit: "pacote" },
  { code: "GRA-005", name: "Massa Espiral TopMix 500g", category: "Grãos & Farinhas", unit: "pacote" },
  { code: "GRA-006", name: "Farinha de Trigo Fina 5kg", category: "Grãos & Farinhas", unit: "saco" },
  { code: "MER-001", name: "Açúcar Castanho Maragra 1kg", category: "Mercearia", unit: "pacote" },
  { code: "MER-002", name: "Óleo Alimentar Soja 1L", category: "Mercearia", unit: "garrafa" },
  { code: "MER-003", name: "Feijão Manteiga 1kg", category: "Mercearia", unit: "pacote" },
  { code: "MER-004", name: "Ervilha Seca 1kg", category: "Mercearia", unit: "pacote" },
  { code: "MER-005", name: "Sal Refinado 1kg", category: "Mercearia", unit: "pacote" },
  { code: "MER-006", name: "Atum em Conserva 170g", category: "Mercearia", unit: "lata" },
  { code: "LAT-001", name: "Leite em Pó Nido 400g", category: "Laticínios & Bebidas", unit: "lata" },
  { code: "LAT-002", name: "Leite UHT Meio Gordo 1L", category: "Laticínios & Bebidas", unit: "pacote" },
  { code: "LAT-003", name: "Café em Grão Chiveve 250g", category: "Laticínios & Bebidas", unit: "pacote" },
  { code: "LAT-004", name: "Chá Preto Gurué 25 saquetas", category: "Laticínios & Bebidas", unit: "caixa" },
  { code: "LAT-005", name: "Refrigerante Cola 2L", category: "Laticínios & Bebidas", unit: "garrafa" },
  { code: "LAT-006", name: "Água Mineral 1,5L", category: "Laticínios & Bebidas", unit: "garrafa" },
  { code: "LIM-001", name: "Sabão em Barra Omo", category: "Higiene & Limpeza", unit: "barra" },
  { code: "LIM-002", name: "Detergente Líquido Sunlight 750ml", category: "Higiene & Limpeza", unit: "garrafa" },
  { code: "LIM-003", name: "Papel Higiênico Renova 4un", category: "Higiene & Limpeza", unit: "pacote" },
  { code: "LIM-004", name: "Lixívia Tradicional 1L", category: "Higiene & Limpeza", unit: "garrafa" },
  { code: "LIM-005", name: "Sabão em Pó Surf 1kg", category: "Higiene & Limpeza", unit: "pacote" },
  { code: "LIM-006", name: "Esponja de Cozinha 3un", category: "Higiene & Limpeza", unit: "pacote" },
  { code: "BEB-001", name: "Sumo de Manga 1L", category: "Bebidas", unit: "pacote" },
  { code: "BEB-002", name: "Água Tónica 330ml", category: "Bebidas", unit: "lata" },
  { code: "SNK-001", name: "Bolachas Maria 200g", category: "Snacks", unit: "pacote" },
  { code: "SNK-002", name: "Amendoim Torrado 150g", category: "Snacks", unit: "pacote" },
];

export const fieldVisitQueryOptions = queryOptions({
  queryKey: ["field-visits"],
  queryFn: async () => {
    const [visitsResult, itemsResult, companiesResult] = await Promise.all([
      supabase.from("visits").select("*").order("started_at", { ascending: false }),
      supabase.from("visit_items").select("*").order("created_at", { ascending: true }),
      supabase.from("companies").select("*").eq("active", true).order("name", { ascending: true }),
    ]);

    if (visitsResult.error) throw visitsResult.error;
    if (itemsResult.error) throw itemsResult.error;
    if (companiesResult.error) throw companiesResult.error;

    return { visits: visitsResult.data, items: itemsResult.data, companies: companiesResult.data };
  },
});

export function addQuantity(current: number, amount: number) {
  return Math.round((current + amount) * 100) / 100;
}

export function canCompleteVisit(itemCount: number) {
  return itemCount > 0;
}

export function durationInMinutes(startedAt: string, completedAt: string | null) {
  if (!completedAt) return null;
  return Math.max(0, Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 60_000));
}

export function formatDuration(minutes: number | null) {
  if (minutes === null || !Number.isFinite(minutes)) return "—";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours} h` : `${hours} h ${remainingMinutes} min`;
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-MZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function localDateValue(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}