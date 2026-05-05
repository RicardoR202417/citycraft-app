import { ArrowLeft, Building2, Landmark, LandPlot, ReceiptText, Scale, ShieldCheck, WalletCards } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge, Card, DataList, EmptyState, LinkButton, PageHeader, SectionHeader, Table } from "../../../components/ui";
import { formatMoney, formatWalletBalance } from "../../../lib/economy";
import {
  formatAuditEntityType,
  formatGovernmentAuditAction,
  getGovernmentAuditTone,
  isGovernmentAuditAction
} from "../../../lib/governmentAudit";
import { getSupabaseServiceClient } from "../../../lib/supabase/server";
import styles from "./page.module.css";

export const metadata = {
  title: "Transparencia del gobierno - CityCraft App"
};

export const dynamic = "force-dynamic";

function formatDate(value) {
  if (!value) {
    return "Pendiente";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
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

function formatPropertyStatus(status) {
  const labels = {
    active: "Activa",
    archived: "Archivada",
    demolished: "Demolida",
    planned: "Planeada",
    under_review: "En revision"
  };

  return labels[status] || status;
}

function getStatusTone(status) {
  const tones = {
    active: "success",
    archived: "neutral",
    demolished: "danger",
    planned: "info",
    under_review: "warning"
  };

  return tones[status] || "neutral";
}

function formatLandDisposition(disposition) {
  const labels = {
    available: "Disponible",
    for_auction: "En subasta",
    for_sale: "En venta",
    reserved: "Reservada"
  };

  return labels[disposition] || "Sin definir";
}

function getLandDispositionTone(disposition) {
  const tones = {
    available: "success",
    for_auction: "warning",
    for_sale: "info",
    reserved: "neutral"
  };

  return tones[disposition] || "neutral";
}

function formatRole(role) {
  const labels = {
    admin: "Admin",
    member: "Miembro",
    owner: "Representante"
  };

  return labels[role] || role;
}

function getLedgerType(type) {
  const labels = {
    auction_settlement: "Cierre de subasta",
    daily_org_payout: "Pago diario organizacion",
    daily_player_payout: "Pago diario jugador",
    fee: "Comision",
    manual_adjustment: "Ajuste manual",
    property_sale: "Venta de propiedad",
    property_transfer: "Transferencia de propiedad",
    system_adjustment: "Ajuste del sistema",
    tax: "Impuesto"
  };

  return labels[type] || type;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export default async function GovernmentTransparencyPage() {
  const serviceSupabase = getSupabaseServiceClient();

  const { data: government } = await serviceSupabase
    .from("organizations")
    .select(
      "id, name, slug, description, is_public, created_at, wallets(id, balance, currency_symbol, updated_at), organization_members(id, profile_id, role, ownership_percent, is_active, joined_at, profiles!organization_members_profile_id_fkey(gamertag, display_name))"
    )
    .eq("type", "government")
    .maybeSingle();

  if (!government) {
    notFound();
  }

  const wallet = Array.isArray(government.wallets) ? government.wallets[0] : government.wallets;
  const members = asArray(government.organization_members).filter((member) => member.is_active);
  const memberProfileIds = members.map((member) => member.profile_id);

  const [
    { data: propertyOwnersData = [] },
    { data: unownedLandsData = [] },
    { data: ledgerEntriesData = [] },
    { data: auditEventsData = [] }
  ] = await Promise.all([
    serviceSupabase
      .from("property_owners")
      .select(
        "id, ownership_percent, properties(id, name, address, type, status, size_blocks, current_value, districts(name))"
      )
      .eq("owner_type", "organization")
      .eq("organization_id", government.id)
      .order("created_at", { ascending: false })
      .limit(30),
    serviceSupabase
      .from("properties")
      .select(
        "id, name, address, status, size_blocks, current_value, government_disposition, districts(name), property_owners(id)"
      )
      .eq("type", "land")
      .not("government_disposition", "is", null)
      .order("created_at", { ascending: false })
      .limit(30),
    wallet?.id
      ? serviceSupabase
          .from("ledger_entries")
          .select("id, entry_type, amount, currency_symbol, from_wallet_id, to_wallet_id, reference_type, description, created_at")
          .or(`from_wallet_id.eq.${wallet.id},to_wallet_id.eq.${wallet.id}`)
          .order("created_at", { ascending: false })
          .limit(25)
      : { data: [] },
    memberProfileIds.length
      ? serviceSupabase
          .from("audit_logs")
          .select("id, action, entity_type, entity_id, created_at, profiles!audit_logs_actor_profile_id_fkey(gamertag, display_name)")
          .in("actor_profile_id", memberProfileIds)
          .order("created_at", { ascending: false })
          .limit(25)
      : { data: [] }
  ]);

  const propertyOwners = asArray(propertyOwnersData);
  const unownedLands = asArray(unownedLandsData).filter((land) => !asArray(land.property_owners).length);
  const ledgerEntries = asArray(ledgerEntriesData);
  const auditEvents = asArray(auditEventsData).filter((event) => isGovernmentAuditAction(event.action));
  const propertyValue = propertyOwners.reduce((total, owner) => {
    const property = owner.properties || {};
    return total + Number(property.current_value || 0) * (Number(owner.ownership_percent || 0) / 100);
  }, 0);
  const incomingTotal = ledgerEntries
    .filter((entry) => entry.to_wallet_id === wallet?.id)
    .reduce((total, entry) => total + Number(entry.amount || 0), 0);
  const outgoingTotal = ledgerEntries
    .filter((entry) => entry.from_wallet_id === wallet?.id)
    .reduce((total, entry) => total + Number(entry.amount || 0), 0);
  const summaryItems = [
    { label: "Organizacion", value: government.name },
    { label: "Slug publico", value: government.slug },
    { label: "Alta", value: formatDate(government.created_at) },
    { label: "Wallet", value: formatWalletBalance(wallet) },
    { label: "Valor inmobiliario", value: formatMoney(propertyValue, wallet?.currency_symbol) },
    { label: "Integrantes visibles", value: members.length.toLocaleString("es-MX") }
  ];

  const memberRows = members.map((member) => ({
    id: member.id,
    player: member.profiles?.display_name || member.profiles?.gamertag || "Jugador no disponible",
    gamertag: member.profiles?.gamertag || "Sin gamertag",
    role: <Badge tone={member.role === "owner" ? "success" : "info"}>{formatRole(member.role)}</Badge>,
    ownership: `${Number(member.ownership_percent || 0).toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}%`
  }));

  const propertyRows = propertyOwners.map((owner) => {
    const property = owner.properties || {};
    const proportionalValue = Number(property.current_value || 0) * (Number(owner.ownership_percent || 0) / 100);

    return {
      id: owner.id,
      property: (
        <div className={styles.nameCell}>
          <strong>{property.name || "Propiedad no disponible"}</strong>
          <span>{property.address || "Sin direccion"}</span>
        </div>
      ),
      district: property.districts?.name || "Sin delegacion",
      type: <Badge tone="info">{formatPropertyType(property.type)}</Badge>,
      status: <Badge tone={getStatusTone(property.status)}>{formatPropertyStatus(property.status)}</Badge>,
      ownership: `${Number(owner.ownership_percent || 0).toLocaleString("es-MX", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}%`,
      value: formatMoney(proportionalValue, wallet?.currency_symbol)
    };
  });

  const unownedLandRows = unownedLands.map((land) => ({
    id: land.id,
    land: (
      <div className={styles.nameCell}>
        <strong>{land.name || "Tierra no disponible"}</strong>
        <span>{land.address || "Sin direccion"}</span>
      </div>
    ),
    district: land.districts?.name || "Sin delegacion",
    disposition: (
      <Badge tone={getLandDispositionTone(land.government_disposition)}>
        {formatLandDisposition(land.government_disposition)}
      </Badge>
    ),
    status: <Badge tone={getStatusTone(land.status)}>{formatPropertyStatus(land.status)}</Badge>,
    size: Number(land.size_blocks || 0).toLocaleString("es-MX"),
    value: formatMoney(land.current_value, wallet?.currency_symbol)
  }));

  const ledgerRows = ledgerEntries.map((entry) => {
    const isIncome = entry.to_wallet_id === wallet?.id;

    return {
      id: entry.id,
      direction: <Badge tone={isIncome ? "success" : "warning"}>{isIncome ? "Entrada" : "Salida"}</Badge>,
      type: getLedgerType(entry.entry_type),
      amount: formatMoney(entry.amount, entry.currency_symbol),
      reference: entry.reference_type || "General",
      description: entry.description || "Sin descripcion",
      createdAt: formatDate(entry.created_at)
    };
  });

  const auditRows = auditEvents.map((event) => ({
    id: event.id,
    action: <Badge tone={getGovernmentAuditTone(event.action)}>{formatGovernmentAuditAction(event.action)}</Badge>,
    entity: formatAuditEntityType(event.entity_type),
    actor: event.profiles?.display_name || event.profiles?.gamertag || "Gobierno",
    createdAt: formatDate(event.created_at)
  }));

  return (
    <main className={styles.page}>
      <PageHeader
        actions={
          <LinkButton href="/" icon={ArrowLeft} variant="secondary">
            Inicio
          </LinkButton>
        }
        description={government.description || "Informacion publica de la entidad de gobierno del Realm."}
        eyebrow="Transparencia publica"
        title="Gobierno de CityCraft"
      />

      <section className={styles.heroGrid}>
        <Card className={styles.card}>
          <SectionHeader
            eyebrow="Perfil"
            title="Datos transparentes"
            description="El gobierno es la unica organizacion con transparencia completa por regla del mundo."
          />
          <DataList items={summaryItems} />
        </Card>

        <Card className={styles.balanceCard}>
          <WalletCards size={26} />
          <strong>{formatWalletBalance(wallet)}</strong>
          <span>Saldo publico del gobierno</span>
          <div className={styles.flow}>
            <span>Entradas recientes: {formatMoney(incomingTotal, wallet?.currency_symbol)}</span>
            <span>Salidas recientes: {formatMoney(outgoingTotal, wallet?.currency_symbol)}</span>
          </div>
        </Card>
      </section>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Representacion"
          title="Integrantes del gobierno"
          description="Jugadores con membresia activa dentro de la organizacion publica."
        />
        {memberRows.length ? (
          <Table
            columns={[
              { key: "player", label: "Jugador" },
              { key: "gamertag", label: "Gamertag" },
              { key: "role", label: "Rol" },
              { key: "ownership", label: "Participacion" }
            ]}
            getRowKey={(row) => row.id}
            rows={memberRows}
          />
        ) : (
          <EmptyState
            description="Aun no hay representantes activos registrados en la organizacion gobierno."
            icon={ShieldCheck}
            title="Sin integrantes visibles"
          />
        )}
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Patrimonio"
          title="Propiedades gubernamentales"
          description="Propiedades registradas a nombre del gobierno y su valor proporcional."
        />
        {propertyRows.length ? (
          <Table
            columns={[
              { key: "property", label: "Propiedad" },
              { key: "district", label: "Delegacion" },
              { key: "type", label: "Tipo" },
              { key: "status", label: "Estado" },
              { key: "ownership", label: "%" },
              { key: "value", label: "Valor gob." }
            ]}
            getRowKey={(row) => row.id}
            rows={propertyRows}
          />
        ) : (
          <EmptyState
            description="Cuando existan tierras, edificios o servicios publicos a nombre del gobierno, apareceran aqui."
            icon={Landmark}
            title="Sin propiedades gubernamentales"
          />
        )}
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Territorio"
          title="Tierras sin dueño"
          description="Terrenos administrados por el gobierno por no tener propietario asignado."
        />
        {unownedLandRows.length ? (
          <Table
            columns={[
              { key: "land", label: "Tierra" },
              { key: "district", label: "Delegacion" },
              { key: "disposition", label: "Disponibilidad" },
              { key: "status", label: "Estado" },
              { key: "size", label: "Bloques" },
              { key: "value", label: "Valor" }
            ]}
            getRowKey={(row) => row.id}
            rows={unownedLandRows}
          />
        ) : (
          <EmptyState
            description="Cuando el gobierno registre terrenos sin propietario, apareceran aqui para transparencia."
            icon={LandPlot}
            title="Sin tierras sin dueño"
          />
        )}
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Economia"
          title="Movimientos publicos"
          description="Movimientos recientes relacionados con la wallet del gobierno."
        />
        {ledgerRows.length ? (
          <Table
            columns={[
              { key: "direction", label: "Flujo" },
              { key: "type", label: "Tipo" },
              { key: "amount", label: "Monto" },
              { key: "reference", label: "Referencia" },
              { key: "description", label: "Descripcion" },
              { key: "createdAt", label: "Fecha" }
            ]}
            getRowKey={(row) => row.id}
            rows={ledgerRows}
          />
        ) : (
          <EmptyState
            description="Cuando el gobierno reciba ingresos o realice pagos, sus movimientos permitidos apareceran aqui."
            icon={ReceiptText}
            title="Sin movimientos publicos"
          />
        )}
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Auditoria"
          title="Acciones recientes"
          description="Eventos recientes ejecutados por integrantes activos del gobierno."
        />
        {auditRows.length ? (
          <Table
            columns={[
              { key: "action", label: "Accion" },
              { key: "entity", label: "Entidad" },
              { key: "actor", label: "Actor" },
              { key: "createdAt", label: "Fecha" }
            ]}
            getRowKey={(row) => row.id}
            rows={auditRows}
          />
        ) : (
          <EmptyState
            description="Las acciones gubernamentales auditadas apareceran aqui cuando existan registros."
            icon={Scale}
            title="Sin acciones recientes"
          />
        )}
      </Card>

      <Card className={styles.noteCard}>
        <SectionHeader
          eyebrow="Alcance"
          title="Transparencia sin secretos"
          description="Esta vista publica expone informacion operativa del gobierno, pero no variables de entorno, claves ni datos privados de otros jugadores."
        />
        <div className={styles.note}>
          <Building2 size={18} />
          <span>La informacion privada de jugadores y organizaciones privadas se mantiene fuera de esta vista.</span>
        </div>
      </Card>
    </main>
  );
}
