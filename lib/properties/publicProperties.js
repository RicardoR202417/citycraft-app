import { createSupabasePublicClient } from "../supabase/public";

export const PUBLIC_PROPERTY_LIMIT = 6;

const PUBLIC_PROPERTY_TYPES = [
  "public",
  "cultural",
  "entertainment",
  "infrastructure",
  "service"
];

const PUBLIC_PROPERTY_SELECT =
  "id, slug, name, address, type, status, description, size_blocks, districts(name, slug)";

export async function getPublicFeaturedProperties(limit = PUBLIC_PROPERTY_LIMIT) {
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("properties")
    .select(PUBLIC_PROPERTY_SELECT)
    .eq("status", "active")
    .in("type", PUBLIC_PROPERTY_TYPES)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data || []).map(normalizePublicProperty);
}

export async function getPublicPropertyBySlug(slug) {
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("properties")
    .select(PUBLIC_PROPERTY_SELECT)
    .eq("slug", slug)
    .eq("status", "active")
    .in("type", PUBLIC_PROPERTY_TYPES)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? normalizePublicProperty(data) : null;
}

export function formatPublicPropertyType(type) {
  const labels = {
    cultural: "Cultural",
    entertainment: "Entretenimiento",
    infrastructure: "Infraestructura",
    public: "Publica",
    service: "Servicio"
  };

  return labels[type] || type || "Propiedad";
}

function normalizePublicProperty(property) {
  return {
    ...property,
    district_name: property.districts?.name || "Ciudad",
    excerpt:
      property.description ||
      "Propiedad publica o destacada registrada como parte visible del crecimiento de CityCraft."
  };
}
