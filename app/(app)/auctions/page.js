import { ArrowLeft, BadgeDollarSign, CircleDollarSign, Gavel, Hourglass, Landmark } from "lucide-react";
import { Badge, Card, DataList, EmptyState, LinkButton, PageHeader, SectionHeader, Table } from "../../../components/ui";
import { requireProfile } from "../../../lib/auth";
import { formatMoney } from "../../../lib/economy";
import { createSupabaseServerClient, getSupabaseServiceClient } from "../../../lib/supabase/server";
import { AuctionForm } from "./AuctionForm";
import styles from "./page.module.css";

export const metadata = {
  title: "Subastas - CityCraft App"
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

function formatTimeLeft(value) {
  if (!value) {
    return "Sin cierre";
  }

  const diffMs = new Date(value).getTime() - Date.now();

  if (diffMs <= 0) {
    return "Finalizada";
  }

  const totalMinutes = Math.ceil(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
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

function formatAuctionStatus(status) {
  const labels = {
    active: "Activa",
    cancelled: "Cancelada",
    expired: "Expirada",
    settled: "Liquidada"
  };

  return labels[status] || status;
}

function getAuctionStatusTone(status) {
  const tones = {
    active: "success",
    cancelled: "danger",
    expired: "neutral",
    settled: "info"
  };

  return tones[status] || "neutral";
}

function getSellerName(auction) {
  if (auction.seller_owner_type === "organization") {
    return auction.organizations?.name || "Organizacion";
  }

  return auction.profiles?.display_name || auction.profiles?.gamertag || "Jugador";
}

function getOwnershipLabel(ownership, organizationsById) {
  const property = ownership.properties;
  const owner =
    ownership.owner_type === "organization"
      ? organizationsById.get(ownership.organization_id)?.name || "Organizacion"
      : "Jugador";

  return `${property?.name || "Propiedad"} (${owner})`;
}

export default async function AuctionsPage() {
  const profile = await requireProfile("/auctions");
  const supabase = await createSupabaseServerClient();
  const serviceSupabase = getSupabaseServiceClient();
  const now = new Date().toISOString();

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
    { data: reservedAuctions = [] },
    { data: activeAuctions = [] },
    { data: ownAuctions = [] }
  ] = await Promise.all([
    ownershipIds.length
      ? serviceSupabase
          .from("market_listings")
          .select("property_owner_id, ownership_percent, status")
          .in("property_owner_id", ownershipIds)
          .in("status", ["active", "paused"])
      : { data: [] },
    ownershipIds.length
      ? serviceSupabase
          .from("auctions")
          .select("property_owner_id, ownership_percent, status, ends_at")
          .in("property_owner_id", ownershipIds)
          .eq("status", "active")
          .gt("ends_at", now)
      : { data: [] },
    serviceSupabase
      .from("auctions")
      .select(
        "id, title, status, ownership_percent, starting_price, currency_symbol, starts_at, ends_at, seller_owner_type, seller_profile_id, seller_organization_id, properties(name, address, type, current_value, districts(name)), profiles!auctions_seller_profile_id_fkey(gamertag, display_name), organizations!auctions_seller_organization_id_fkey(name)"
      )
      .eq("status", "active")
      .gt("ends_at", now)
      .order("ends_at", { ascending: true })
      .limit(50),
    serviceSupabase
      .from("auctions")
      .select(
        "id, title, status, ownership_percent, starting_price, currency_symbol, starts_at, ends_at, seller_owner_type, seller_profile_id, seller_organization_id, properties(name, address, type, current_value, districts(name)), profiles!auctions_seller_profile_id_fkey(gamertag, display_name), organizations!auctions_seller_organization_id_fkey(name)"
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

  for (const auction of reservedAuctions) {
    reservedByOwner.set(
      auction.property_owner_id,
      (reservedByOwner.get(auction.property_owner_id) || 0) + Number(auction.ownership_percent || 0)
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

  const activeRows = asArray(activeAuctions).map((auction) => ({
    id: auction.id,
    auction: (
      <div className={styles.nameCell}>
        <strong>{auction.title}</strong>
        <span>{auction.properties?.name || "Propiedad no disponible"}</span>
      </div>
    ),
    seller: getSellerName(auction),
    district: auction.properties?.districts?.name || "Sin delegacion",
    type: <Badge tone="info">{formatPropertyType(auction.properties?.type)}</Badge>,
    percent: formatPercent(auction.ownership_percent),
    price: formatMoney(auction.starting_price, auction.currency_symbol),
    ends: (
      <div className={styles.timeCell}>
        <strong>{formatTimeLeft(auction.ends_at)}</strong>
        <span>{formatDate(auction.ends_at)}</span>
      </div>
    )
  }));

  const ownRows = asArray(ownAuctions).map((auction) => ({
    id: auction.id,
    auction: (
      <div className={styles.nameCell}>
        <strong>{auction.title}</strong>
        <span>{auction.properties?.name || "Propiedad no disponible"}</span>
      </div>
    ),
    status: <Badge tone={getAuctionStatusTone(auction.status)}>{formatAuctionStatus(auction.status)}</Badge>,
    percent: formatPercent(auction.ownership_percent),
    price: formatMoney(auction.starting_price, auction.currency_symbol),
    starts: formatDate(auction.starts_at),
    ends: (
      <div className={styles.timeCell}>
        <strong>{formatTimeLeft(auction.ends_at)}</strong>
        <span>{formatDate(auction.ends_at)}</span>
      </div>
    )
  }));

  const activeValue = asArray(activeAuctions).reduce(
    (sum, auction) => sum + Number(auction.starting_price || 0),
    0
  );
  const summaryItems = [
    { label: "Subastas activas", value: activeAuctions.length.toLocaleString("es-MX") },
    { label: "Valor inicial publicado", value: formatMoney(activeValue) },
    { label: "Participaciones subastables", value: ownershipOptions.length.toLocaleString("es-MX") },
    { label: "Tus subastas", value: ownAuctions.length.toLocaleString("es-MX") },
    { label: "Duraciones permitidas", value: "20m, 10h, 1d, 1s" }
  ];

  return (
    <main className={styles.page}>
      <PageHeader
        actions={
          <LinkButton href="/dashboard" icon={ArrowLeft} variant="secondary">
            Dashboard
          </LinkButton>
        }
        description="Crea subastas con tiempo limitado para vender propiedades o porcentajes al mejor postor."
        eyebrow="Mercado inmobiliario"
        title="Subastas"
      />

      <section className={styles.grid}>
        <Card className={styles.card}>
          <SectionHeader
            description="Las subastas activas reservan el porcentaje de propiedad hasta su cierre, cancelacion o liquidacion."
            eyebrow="Resumen"
            title="Actividad de subastas"
          />
          <DataList items={summaryItems} />
        </Card>

        <Card className={styles.auctionCard}>
          <Gavel size={24} />
          <strong>{formatMoney(activeValue)}</strong>
          <span>Precio inicial acumulado de subastas activas</span>
        </Card>
      </section>

      <Card className={styles.card}>
        <SectionHeader
          description="Selecciona una participacion directa o una propiedad de una organizacion donde seas owner/admin."
          eyebrow="Nueva subasta"
          title="Configurar subasta"
        />
        {ownershipOptions.length ? (
          <AuctionForm ownershipOptions={ownershipOptions} />
        ) : (
          <EmptyState
            description="Necesitas tener propiedades directas o administrar una organizacion propietaria para crear una subasta."
            icon={BadgeDollarSign}
            title="Sin participaciones subastables"
          />
        )}
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          description="Subastas vigentes visibles para jugadores autenticados. Las pujas se integran en la siguiente historia."
          eyebrow="Activas"
          title="Subastas abiertas"
        />
        {activeRows.length ? (
          <Table
            columns={[
              { key: "auction", label: "Subasta" },
              { key: "seller", label: "Vendedor" },
              { key: "district", label: "Delegacion" },
              { key: "type", label: "Tipo" },
              { key: "percent", label: "%" },
              { key: "price", label: "Precio inicial" },
              { key: "ends", label: "Cierre" }
            ]}
            getRowKey={(row) => row.id}
            rows={activeRows}
          />
        ) : (
          <EmptyState
            description="Cuando un propietario cree una subasta activa, aparecera aqui con su tiempo restante."
            icon={Hourglass}
            title="Sin subastas activas"
          />
        )}
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          description="Tus subastas directas y las de organizaciones donde puedes administrar propiedades."
          eyebrow="Mis subastas"
          title="Publicaciones propias"
        />
        {ownRows.length ? (
          <Table
            columns={[
              { key: "auction", label: "Subasta" },
              { key: "status", label: "Estado" },
              { key: "percent", label: "%" },
              { key: "price", label: "Precio inicial" },
              { key: "starts", label: "Inicio" },
              { key: "ends", label: "Cierre" }
            ]}
            getRowKey={(row) => row.id}
            rows={ownRows}
          />
        ) : (
          <EmptyState
            description="Aun no has creado subastas de propiedades o porcentajes."
            icon={CircleDollarSign}
            title="Sin subastas propias"
          />
        )}
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          description="CCAPP-54 deja lista la base de subastas. Las pujas, validaciones de saldo y cierre atomico avanzan en las siguientes historias del sprint."
          eyebrow="Siguiente flujo"
          title="Bloqueo de porcentaje activo"
        />
        <EmptyState
          description="El porcentaje subastado queda reservado junto con las ventas activas para evitar doble publicacion de la misma participacion."
          icon={Landmark}
          title="Reserva compartida entre mercado y subastas"
        />
      </Card>
    </main>
  );
}
