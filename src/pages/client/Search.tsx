import { useState, useCallback, useRef, useEffect } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import SearchFilters from "@/components/search/SearchFilters";
import PropertyCard from "@/components/search/PropertyCard";
import SearchMap from "@/components/search/SearchMap";
import CompareBar from "@/components/search/CompareBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { List, Map as MapIcon } from "lucide-react";
import type { Property, PropertyPhoto } from "@/types/database";

export interface SearchFiltersState {
  operation: "SALE" | "RENT" | null;
  types: string[];
  city: string;
  priceMin: number | null;
  priceMax: number | null;
  rooms: number | null;
  surfaceMin: number | null;
  surfaceMax: number | null;
  amenities: string[];
}

const PAGE_SIZE = 12;

const defaultFilters: SearchFiltersState = {
  operation: null,
  types: [],
  city: "",
  priceMin: null,
  priceMax: null,
  rooms: null,
  surfaceMin: null,
  surfaceMax: null,
  amenities: [],
};

type PropertyWithPhotos = Property & { property_photos: PropertyPhoto[] };

async function fetchProperties({ pageParam = 0, filters }: { pageParam: number; filters: SearchFiltersState }) {
  let query = supabase
    .from("properties")
    .select("*, property_photos(*)")
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

  if (filters.operation) query = query.eq("operation", filters.operation);
  if (filters.types.length) query = query.in("type", filters.types);
  if (filters.city) query = query.ilike("address_city", `%${filters.city}%`);
  if (filters.priceMin) query = query.gte("price", filters.priceMin);
  if (filters.priceMax) query = query.lte("price", filters.priceMax);
  if (filters.rooms) query = filters.rooms >= 4 ? query.gte("rooms", 4) : query.eq("rooms", filters.rooms);
  if (filters.surfaceMin) query = query.gte("surface_total", filters.surfaceMin);
  if (filters.surfaceMax) query = query.lte("surface_total", filters.surfaceMax);

  const { data, error } = await query;
  if (error) throw error;
  return { data: data as PropertyWithPhotos[], nextPage: data.length === PAGE_SIZE ? pageParam + 1 : undefined };
}

export default function Search() {
  const [filters, setFilters] = useState<SearchFiltersState>(defaultFilters);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["search-properties", filters],
    queryFn: ({ pageParam }) => fetchProperties({ pageParam: pageParam as number, filters }),
    getNextPageParam: (last) => last.nextPage,
    initialPageParam: 0,
    staleTime: 2 * 60 * 1000,
  });

  const properties = data?.pages.flatMap((p) => p.data) ?? [];

  // Favorites
  const { data: favorites = [] } = useInfiniteQuery({
    queryKey: ["user-favorites", user?.id],
    queryFn: async () => {
      if (!user) return { data: [] as string[], nextPage: undefined };
      const { data } = await supabase.from("favorites").select("property_id").eq("user_id", user.id);
      return { data: (data ?? []).map((f: any) => f.property_id), nextPage: undefined };
    },
    getNextPageParam: () => undefined,
    initialPageParam: 0,
    enabled: !!user,
  });
  const favIds = favorites?.pages?.[0]?.data ?? [];

  const toggleFav = useMutation({
    mutationFn: async (propertyId: string) => {
      if (!user) { navigate("/login"); return; }
      const isFav = favIds.includes(propertyId);
      if (isFav) {
        await supabase.from("favorites").delete().eq("user_id", user.id).eq("property_id", propertyId);
      } else {
        await supabase.from("favorites").insert({ user_id: user.id, property_id: propertyId });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-favorites"] }),
  });

  // Infinite scroll
  const observerRef = useRef<IntersectionObserver>();
  const lastCardRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isFetchingNextPage) return;
      if (observerRef.current) observerRef.current.disconnect();
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage) fetchNextPage();
      });
      if (node) observerRef.current.observe(node);
    },
    [isFetchingNextPage, hasNextPage, fetchNextPage]
  );

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) { toast.error("Máximo 3 propiedades para comparar"); return prev; }
      return [...prev, id];
    });
  };

  // Save search
  const saveSearch = async () => {
    if (!user) { navigate("/login"); return; }
    await supabase.from("saved_searches").insert({
      user_id: user.id,
      filters_json: filters as any,
      alert_enabled: true,
    });
    toast.success("Búsqueda guardada con alertas activadas");
  };

  // Scroll to card when marker clicked
  useEffect(() => {
    if (selectedId && listRef.current) {
      const el = listRef.current.querySelector(`[data-property-id="${selectedId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedId]);

  const content = (
    <>
      <SearchFilters filters={filters} onChange={setFilters} onSave={saveSearch} />
      {isMobile ? (
        <Tabs defaultValue="list" className="flex-1 flex flex-col">
          <TabsList className="mx-4 mt-2">
            <TabsTrigger value="list" className="gap-1"><List className="h-4 w-4" /> Lista</TabsTrigger>
            <TabsTrigger value="map" className="gap-1"><MapIcon className="h-4 w-4" /> Mapa</TabsTrigger>
          </TabsList>
          <TabsContent value="list" className="flex-1 overflow-auto p-4 space-y-4">
            <PropertyList
              properties={properties}
              favIds={favIds}
              compareIds={compareIds}
              hoveredId={hoveredId}
              selectedId={selectedId}
              onHover={setHoveredId}
              onToggleFav={(id) => toggleFav.mutate(id)}
              onToggleCompare={toggleCompare}
              lastCardRef={lastCardRef}
              isLoading={isLoading}
              listRef={listRef}
            />
          </TabsContent>
          <TabsContent value="map" className="flex-1">
            <SearchMap
              properties={properties}
              hoveredId={hoveredId}
              selectedId={selectedId}
              onHover={setHoveredId}
              onSelect={setSelectedId}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div ref={listRef} className="w-[35%] overflow-auto p-4 space-y-4 border-r border-border">
            <PropertyList
              properties={properties}
              favIds={favIds}
              compareIds={compareIds}
              hoveredId={hoveredId}
              selectedId={selectedId}
              onHover={setHoveredId}
              onToggleFav={(id) => toggleFav.mutate(id)}
              onToggleCompare={toggleCompare}
              lastCardRef={lastCardRef}
              isLoading={isLoading}
              listRef={listRef}
            />
          </div>
          <div className="w-[65%]">
            <SearchMap
              properties={properties}
              hoveredId={hoveredId}
              selectedId={selectedId}
              onHover={setHoveredId}
              onSelect={setSelectedId}
            />
          </div>
        </div>
      )}
      {compareIds.length > 0 && (
        <CompareBar ids={compareIds} onClear={() => setCompareIds([])} />
      )}
    </>
  );

  return <div className="flex flex-col h-screen">{content}</div>;
}

/* Internal list component */
function PropertyList({
  properties,
  favIds,
  compareIds,
  hoveredId,
  selectedId,
  onHover,
  onToggleFav,
  onToggleCompare,
  lastCardRef,
  isLoading,
  listRef,
}: {
  properties: PropertyWithPhotos[];
  favIds: string[];
  compareIds: string[];
  hoveredId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onToggleFav: (id: string) => void;
  onToggleCompare: (id: string) => void;
  lastCardRef: (node: HTMLDivElement | null) => void;
  isLoading: boolean;
  listRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!properties.length) {
    return <p className="text-muted-foreground text-center py-12">No se encontraron propiedades con estos filtros.</p>;
  }

  return (
    <>
      {properties.map((p, i) => (
        <div
          key={p.id}
          ref={i === properties.length - 1 ? lastCardRef : undefined}
          data-property-id={p.id}
        >
          <PropertyCard
            property={p}
            isFav={favIds.includes(p.id)}
            isCompare={compareIds.includes(p.id)}
            isHovered={hoveredId === p.id}
            isSelected={selectedId === p.id}
            onHover={onHover}
            onToggleFav={onToggleFav}
            onToggleCompare={onToggleCompare}
          />
        </div>
      ))}
    </>
  );
}
