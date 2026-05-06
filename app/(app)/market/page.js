import { ArrowLeft, BadgeDollarSign, Building2, CircleDollarSign, Store, Tags } from "lucide-react";
import { Badge, Card, DataList, EmptyState, LinkButton, PageHeader, SectionHeader, Table } from "../../../components/ui";
import { requireProfile } from "../../../lib/auth";
import { formatMoney } from "../../../lib/economy";
import { createSupabaseServerClient, getSupabaseServiceClient } from "../../../lib/supabase/server";
import { MarketListingForm } from "./MarketListingForm";
import styles from "./page.module.css";

export const metadata = {
  title: "Mercado - CityCraft App"
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatDate(value) {
  if (!value) {
    return "Pendiente";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatPercent(value) {
  return `${Number(value || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}%`;
}

function formatPropertyType(type) {
  const labels = {
    commercial: "Local",
    corporate: "Corporativo",
    cultural: "Cultural",
    entertainment: "Entretenimiento",
    infrastructure: "Infraestructura",
    land: "Terreno",
    public: "Publica",
    residential: "Habitacional",
    service: "Servicio"
  };

  return labels[type] || type;
}

function formatListingStatus(status) {
  const labels = {
    active: "Activa",
    cancelled: "Cancelada",
    paused: "Pausada",
    sold: "Vendida"
  };

  return labels[status] || status;
}

function getListingStatusTone(status) {
  const tones = {
    active: "success",
    cancelled: "danger",
    paused: "warning",
    sold: "info"
  };

  return tones[status] || "neutral";
}

function getSellerName(listing) {
  if (listing.seller_owner_type === "organization") {
    return listing.organizations?.name || "Organizacion";
  }

  return listing.profiles?.display_name || listing.profiles?.gamertag || "Jugador";
}

function getOwnershipLabel(ownership, organizationsById) {
  const property = ownership.properties;
  const owner =
    ownership.owner_type === "organization"
      ? organizationsById.get(ownership.organization_id)?.name || "Organizacion"
      : "Jugador";

  return `${property?.name || "Propiedad"} (${owner})`;
}

export default async function MarketPage() {
  const profile = await requireProfile("/market");
  const supabase = await createSupabaseServerClient();
  const serviceSupabase = getSupabaseServiceClient();

  const { data: directOwnerships = [] } = await supabase
    .from("property_owners")
    .select(
      "id, owner_type, profile_id, organization_id, ownership_percent, properties(id, name, address, type, current_value, districts(name))"
    )
    .eq("profile_id", profile.id)
    .order("acquired_at", { ascending: false });

  const { data: adminMemberships = [] } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(id, name)")
    .eq("profile_id", profile.id)
    .eq("is_active", true)
    .in("role", ["owner", "admin"]);

  const adminOrganizationIds = adminMemberships.map((membership) => membership.organization_id).filter(Boolean);

  const { data: organizationOwnerships = [] } = adminOrganizationIds.length
    ? await supabase
        .from("property_owners")
        .select(
          "id, owner_type, profile_id, organization_id, ownership_percent, properties(id, name, address, type, current_value, districts(name))"
        )
        .in("organization_id", adminOrganizationIds)
        .order("acquired_at", { ascending: false })
    : { data: [] };

  const ownerships = [...asArray(directOwnerships), ...asArray(organizationOwnerships)];
  const ownershipIds = ownerships.map((ownership) => ownership.id);

  const [
    { data: reservedListings = [] },
    { data: activeListings = [] },
    { data: ownListings = [] }
  ] = await Promise.all([
    ownershipIds.length
      ? serviceSupabase
          .from("market_listings")
          .select("property_owner_id, ownership_percent, status")
          .in("property_owner_id", ownershipIds)
          .in("status", ["active", "paused"])
      : { data: [] },
    serviceSupabase
      .from("market_listings")
      .select(
        "id, title, status, ownership_percent, asking_price, currency_symbol, created_at, seller_owner_type, properties(name, address, type, current_value, districts(name)), profiles!market_listings_seller_profile_id_fkey(gamertag, display_name), organizations!market_listings_seller_organization_id_fkey(name)"
      )
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(50),
    serviceSupabase
      .from("market_listings")
      .select(
        "id, title, status, ownership_percent, asking_price, currency_symbol, created_at, seller_owner_type, seller_profile_id, seller_organization_id, properties(name, address, type, current_value, districts(name)), profiles!market_listings_seller_profile_id_fkey(gamertag, display_name), organizations!market_listings_seller_organization_id_fkey(name)"
      )
      .or(
        [
          `seller_profile_id.eq.${profile.id}`,
          ...adminOrganizationIds.map((organizationId) => `seller_organization_id.eq.${organizationId}`)
        ].join(",")
      )
      .order("created_at", { ascending: false })
      .limit(30)
  ]);

  const organizationsById = new Map(
    adminMemberships.map((membership) => [membership.organization_id, membership.organizations])
  );
  const reservedByOwner = new Map();

  for (const listing of reservedListings) {
    reservedByOwner.set(
      listing.property_owner_id,
      (reservedByOwner.get(listing.property_owner_id) || 0) + Number(listing.ownership_percent || 0)
    );
  }

  const ownershipOptions = ownerships.map((ownership) => {
    const availablePercent = Math.max(
      Number(ownership.ownership_percent || 0) - Number(reservedByOwner.get(ownership.id) || 0),
      0
    );

    return {
      availablePercent,
      availablePercentLabel: formatPercent(availablePercent),
      id: ownership.id,
      label: getOwnershipLabel(ownership, organizationsById)
    };
  });

  const activeRows = asArray(activeListings).map((listing) => ({
    id: listing.id,
    listing: (
      <div className={styles.nameCell}>
        <strong>{listing.title}</strong>
        <span>{listing.properties?.name || "Propiedad no disponible"}</span>
      </div>
    ),
    seller: getSellerName(listing),
    district: listing.properties?.districts?.name || "Sin delegacion",
    type: <Badge tone="info">{formatPropertyType(listing.properties?.type)}</Badge>,
    percent: formatPercent(listing.ownership_percent),
    price: formatMoney(listing.asking_price, listing.currency_symbol),
    date: formatDate(listing.created_at)
  }));

  const ownRows = asArray(ownListings).map((listing) => ({
    id: listing.id,
    listing: (
      <div className={styles.nameCell}>
        <strong>{listing.title}</strong>
        <span>{listing.properties?.name || "Propiedad no disponible"}</span>
      </div>
    ),
    status: <Badge tone={getListingStatusTone(listing.status)}>{formatListingStatus(listing.status)}</Badge>,
    seller: getSellerName(listing),
    percent: formatPercent(listing.ownership_percent),
    price: formatMoney(listing.asking_price, listing.currency_symbol),
    date: formatDate(listing.created_at)
  }));

  const activeValue = asArray(activeListings).reduce(
    (sum, listing) => sum + Number(listing.asking_price || 0),
    0
  );
  const summaryItems = [
    { label: "Ventas activas", value: activeListings.length.toLocaleString("es-MX") },
    { label: "Valor publicado", value: formatMoney(activeValue) },
    { label: "Participaciones vendibles", value: ownershipOptions.length.toLocaleString("es-MX") },
    { label: "Tus publicaciones", value: ownListings.length.toLocaleString("es-MX") }
  ];

  return (
    <main className={styles.page}>
      <PageHeader
        actions={
          <LinkButton href="/dashboard" icon={ArrowLeft} variant="secondary">
            Dashboard
          </LinkButton>
        }
        description="Publica porcentajes de propiedad, revisa ventas activas y prepara el flujo de ofertas del mercado."
        eyebrow="Mercado inmobiliario"
        title="Mercado"
      />

      <section className={styles.grid}>
        <Card className={styles.card}>
          <SectionHeader
            description="Estado operativo de publicaciones de venta. Las ofertas y cierres atomicos se integran en las siguientes historias."
            eyebrow="Resumen"
            title="Actividad del mercado"
          />
          <DataList items={summaryItems} />
        </Card>

        <Card className={styles.marketCard}>
          <Store size={24} />
          <strong>{formatMoney(activeValue)}</strong>
          <span>Valor base actualmente publicado</span>
        </Card>
      </section>

      <Card className={styles.card}>
        <SectionHeader
          description="Selecciona una participacion directa o una propiedad de una organizacion donde seas owner/admin."
          eyebrow="Nueva venta"
          title="Publicar porcentaje"
        />
        {ownershipOptions.length ? (
          <MarketListingForm ownershipOptions={ownershipOptions} />
        ) : (
          <EmptyState
            description="Necesitas tener propiedades directas o administrar una organizacion propietaria para publicar una venta."
            icon={BadgeDollarSign}
            title="Sin participaciones vendibles"
          />
        )}
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          description="Publicaciones activas visibles para los jugadores autenticados."
          eyebrow="Ventas"
          title="Mercado activo"
        />
        {activeRows.length ? (
          <Table
            columns={[
              { key: "listing", label: "Publicacion" },
              { key: "seller", label: "Vendedor" },
              { key: "district", label: "Delegacion" },
              { key: "type", label: "Tipo" },
              { key: "percent", label: "%" },
              { key: "price", label: "Precio base" },
              { key: "date", label: "Publicada" }
            ]}
            getRowKey={(row) => row.id}
            rows={activeRows}
          />
        ) : (
          <EmptyState
            description="Cuando un propietario publique porcentaje disponible en venta, aparecera aqui."
            icon={Tags}
            title="Sin ventas activas"
          />
        )}
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          description="Tus publicaciones conservan estado para preparar pausa, venta y cancelacion en historias posteriores."
          eyebrow="Mis ventas"
          title="Publicaciones propias"
        />
        {ownRows.length ? (
          <Table
            columns={[
              { key: "listing", label: "Publicacion" },
              { key: "status", label: "Estado" },
              { key: "seller", label: "Vendedor" },
              { key: "percent", label: "%" },
              { key: "price", label: "Precio base" },
              { key: "date", label: "Publicada" }
            ]}
            getRowKey={(row) => row.id}
            rows={ownRows}
          />
        ) : (
          <EmptyState
            description="Aun no has publicado propiedades o porcentajes en venta."
            icon={CircleDollarSign}
            title="Sin publicaciones propias"
          />
        )}
      </Card>
    </main>
  );
}
