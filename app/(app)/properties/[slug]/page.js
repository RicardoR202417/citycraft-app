import {
  ArrowLeft,
  BadgeDollarSign,
  ClipboardCheck,
  Gavel,
  HandCoins,
  Landmark,
  Layers3,
  MapPinned,
  Percent,
  ShieldCheck,
  Wrench
} from "lucide-react";
import { notFound } from "next/navigation";
import {
  Badge,
  CrudActionList,
  CrudLayout,
  CrudPanel,
  CrudWorkspace,
  DataList,
  EmptyState,
  LinkButton,
  PageHeader,
  SectionHeader,
  Table
} from "../../../../components/ui";
import {
  calculateDistrictAppreciation,
  formatAppreciationRate,
  formatAppreciationTrend,
  getAppreciationTrendTone
} from "../../../../lib/appreciation";
import { isGlobalAdmin, isGovernmentMember, requireProfile } from "../../../../lib/auth";
import { formatMoney } from "../../../../lib/economy";
import { createSupabaseServerClient, getSupabaseServiceClient } from "../../../../lib/supabase/server";
import { PropertyFloorForm } from "./PropertyFloorForm";
import styles from "./page.module.css";

export const metadata = {
  title: "Detalle de propiedad - CityCraft App"
};

const PROPERTY_TYPES = {
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

const PROPERTY_STATUSES = {
  active: "Activa",
  archived: "Archivada",
  demolished: "Demolida",
  planned: "Planeada",
  under_review: "En revision"
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
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  }).format(new Date(value));
}

function formatPercent(value) {
  return `${Number(value || 0).toLocaleString("es-MX", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })}%`;
}

function formatPropertyType(type) {
  return PROPERTY_TYPES[type] || type || "Sin tipo";
}

function formatPropertyStatus(status) {
  return PROPERTY_STATUSES[status] || status || "Sin estado";
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

function getOwnerName(owner) {
  if (owner.owner_type === "organization") {
    return owner.organizations?.name || "Organizacion";
  }

  return owner.profiles?.display_name || owner.profiles?.gamertag || "Jugador";
}

function getOwnerKind(owner) {
  return owner.owner_type === "organization" ? "Organizacion" : "Jugador";
}

function canOperateOwner(owner, profileId, adminOrganizationIds) {
  if (owner.owner_type === "profile") {
    return owner.profile_id === profileId;
  }

  return adminOrganizationIds.includes(owner.organization_id);
}

export default async function PropertyDetailPage({ params }) {
  const routeParams = await params;
  const profile = await requireProfile(`/properties/${routeParams.slug}`);
  const supabase = await createSupabaseServerClient();
  const serviceSupabase = getSupabaseServiceClient();

  const [{ data: property }, isGovernment, isAdmin] = await Promise.all([
    serviceSupabase
      .from("properties")
      .select(
        "id, district_id, parent_property_id, name, slug, address, type, status, size_blocks, land_area_blocks, building_area_blocks, current_value, description, created_at, updated_at, districts(id, name, slug, base_appreciation_rate), parent:parent_property_id(id, name, slug)"
      )
      .eq("slug", routeParams.slug)
      .maybeSingle(),
    isGovernmentMember(supabase, profile.id),
    isGlobalAdmin(supabase, profile.id)
  ]);

  if (!property) {
    notFound();
  }

  const [
    { data: owners = [] },
    { data: valuations = [] },
    { data: districtProperties = [] },
    { data: allPropertyOwners = [] },
    { data: latestAppreciation },
    { data: activeListings = [] },
    { data: activeAuctions = [] },
    { data: floors = [] },
    { data: adminMemberships = [] }
  ] = await Promise.all([
    serviceSupabase
      .from("property_owners")
      .select(
        "id, owner_type, profile_id, organization_id, ownership_percent, acquired_at, profiles(gamertag, display_name), organizations(name, slug, type)"
      )
      .eq("property_id", property.id)
      .order("ownership_percent", { ascending: false }),
    serviceSupabase
      .from("property_valuations")
      .select("id, value, reason, metadata, created_at")
      .eq("property_id", property.id)
      .order("created_at", { ascending: false })
      .limit(20),
    serviceSupabase
      .from("properties")
      .select("id, district_id, type, status, size_blocks, current_value, created_at, updated_at"),
    serviceSupabase
      .from("property_owners")
      .select("property_id, owner_type, profile_id, organization_id, ownership_percent"),
    serviceSupabase
      .from("district_appreciation_history")
      .select("id, district_id, previous_index, new_index, change_amount, reason, factors, created_at")
      .eq("district_id", property.district_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    serviceSupabase
      .from("market_listings")
      .select("id, title, status, ownership_percent, asking_price, currency_symbol, created_at")
      .eq("property_id", property.id)
      .in("status", ["active", "paused"])
      .order("created_at", { ascending: false })
      .limit(10),
    serviceSupabase
      .from("auctions")
      .select("id, title, status, ownership_percent, starting_price, currency_symbol, starts_at, ends_at")
      .eq("property_id", property.id)
      .eq("status", "active")
      .order("ends_at", { ascending: true })
      .limit(10),
    serviceSupabase
      .from("property_floors")
      .select("id, floor_number, name, area_blocks, updated_at")
      .eq("property_id", property.id)
      .order("floor_number", { ascending: true }),
    supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("profile_id", profile.id)
      .eq("is_active", true)
      .in("role", ["owner", "admin"])
  ]);

  const adminOrganizationIds = asArray(adminMemberships).map((membership) => membership.organization_id);
  const userOwnerships = asArray(owners).filter((owner) => canOperateOwner(owner, profile.id, adminOrganizationIds));
  const userPercent = userOwnerships.reduce((sum, owner) => sum + Number(owner.ownership_percent || 0), 0);
  const districtMetrics = calculateDistrictAppreciation(property.districts, districtProperties, {
    owners: allPropertyOwners,
    previousIndex: latestAppreciation?.new_index
  });
  const isVisible = property.status === "active" || property.status === "planned";
  const terrainArea = Number(property.land_area_blocks || property.size_blocks || 0);
  const constructionArea = Number(property.building_area_blocks || 0);

  const summaryItems = [
    { label: "Delegacion", value: property.districts?.name || "Sin delegacion" },
    { label: "Direccion", value: property.address },
    { label: "Tipo", value: formatPropertyType(property.type) },
    { label: "Estado", value: formatPropertyStatus(property.status) },
    { label: "Valor actual", value: formatMoney(property.current_value) },
    { label: "Tu porcentaje operativo", value: formatPercent(userPercent) }
  ];

  const areaItems = [
    { label: "Terreno registrado", value: `${terrainArea.toLocaleString("es-MX")} bloques` },
    { label: "Construccion total", value: `${constructionArea.toLocaleString("es-MX")} bloques` },
    { label: "Plantas registradas", value: floors.length },
    { label: "Propiedad matriz", value: property.parent?.name || "No aplica" }
  ];

  const floorRows = asArray(floors).map((floor) => ({
    id: floor.id,
    name: (
      <div className={styles.nameCell}>
        <strong>{floor.name}</strong>
        <span>Planta {floor.floor_number}</span>
      </div>
    ),
    area: `${Number(floor.area_blocks || 0).toLocaleString("es-MX")} bloques`,
    updatedAt: formatDate(floor.updated_at)
  }));

  const ownerRows = asArray(owners).map((owner) => ({
    id: owner.id,
    owner: (
      <div className={styles.nameCell}>
        <strong>{getOwnerName(owner)}</strong>
        <span>{getOwnerKind(owner)}</span>
      </div>
    ),
    percent: formatPercent(owner.ownership_percent),
    acquiredAt: formatDate(owner.acquired_at),
    role: canOperateOwner(owner, profile.id, adminOrganizationIds) ? (
      <Badge tone="success">Puedes operar</Badge>
    ) : (
      <Badge tone="neutral">Solo consulta</Badge>
    )
  }));

  const valuationRows = asArray(valuations).map((valuation) => ({
    id: valuation.id,
    value: formatMoney(valuation.value),
    reason: valuation.reason,
    date: formatDate(valuation.created_at)
  }));

  const listingRows = asArray(activeListings).map((listing) => ({
    id: listing.id,
    title: listing.title,
    percent: formatPercent(listing.ownership_percent),
    price: formatMoney(listing.asking_price, listing.currency_symbol),
    status: <Badge tone={listing.status === "active" ? "success" : "warning"}>{listing.status}</Badge>,
    date: formatDate(listing.created_at)
  }));

  const auctionRows = asArray(activeAuctions).map((auction) => ({
    id: auction.id,
    title: auction.title,
    percent: formatPercent(auction.ownership_percent),
    price: formatMoney(auction.starting_price, auction.currency_symbol),
    status: <Badge tone="success">{auction.status}</Badge>,
    endsAt: formatDate(auction.ends_at)
  }));

  const actions = [
    {
      href: "/properties",
      icon: ArrowLeft,
      label: "Volver",
      variant: "secondary"
    },
    ...(userPercent > 0
      ? [
          {
            href: `/market?property=${property.id}`,
            icon: HandCoins,
            label: "Vender"
          },
          {
            href: `/auctions?property=${property.id}`,
            icon: Gavel,
            label: "Subastar"
          },
          {
            href: `/properties?property_id=${property.id}#permit-request`,
            icon: Wrench,
            label: "Solicitar cambio",
            variant: "secondary"
          }
        ]
      : []),
    ...(isGovernment
      ? [
          {
            href: `/government?property=${property.id}`,
            icon: Landmark,
            label: "Gobierno",
            variant: "secondary"
          }
        ]
      : []),
    ...(isAdmin
      ? [
          {
            href: `/admin/properties?property=${property.id}`,
            icon: ShieldCheck,
            label: "Admin",
            variant: "secondary"
          }
        ]
      : [])
  ];

  return (
    <main className={styles.page}>
      <PageHeader
        actions={<CrudActionList actions={actions} />}
        description={property.description || "Detalle operativo de propiedad, propietarios, valor, plusvalia y actividad de mercado."}
        eyebrow="Detalle de propiedad"
        title={property.name}
      />

      <CrudLayout>
        <CrudWorkspace
          sidebar={
            <>
              <CrudPanel title="Resumen">
                <DataList items={summaryItems} />
              </CrudPanel>
              <CrudPanel title="Visibilidad">
                <div className={styles.statusPanel}>
                  <Badge tone={isVisible ? "success" : "neutral"}>{isVisible ? "Visible" : "No visible"}</Badge>
                  <Badge tone={getStatusTone(property.status)}>{formatPropertyStatus(property.status)}</Badge>
                </div>
              </CrudPanel>
            </>
          }
        >
          <CrudPanel title="Valor y plusvalia">
            <div className={styles.valueGrid}>
              <article>
                <BadgeDollarSign size={22} />
                <span>Valor actual</span>
                <strong>{formatMoney(property.current_value)}</strong>
              </article>
              <article>
                <MapPinned size={22} />
                <span>Plusvalia zona</span>
                <strong>{formatAppreciationRate(districtMetrics.currentRate)}</strong>
                <Badge tone={getAppreciationTrendTone(districtMetrics.trend)}>
                  {formatAppreciationTrend(districtMetrics.trend)}
                </Badge>
              </article>
              <article>
                <Percent size={22} />
                <span>Tu participacion</span>
                <strong>{formatPercent(userPercent)}</strong>
              </article>
            </div>
          </CrudPanel>

          <CrudPanel title="Areas">
            <DataList items={areaItems} />
            {floorRows.length ? (
              <Table
                columns={[
                  { key: "name", label: "Planta" },
                  { key: "area", label: "Area" },
                  { key: "updatedAt", label: "Actualizada" }
                ]}
                getRowKey={(row) => row.id}
                rows={floorRows}
              />
            ) : (
              <EmptyState
                description="Las propiedades tipo terreno pueden no tener plantas. Gobierno o admin pueden agregarlas cuando exista construccion."
                icon={Layers3}
                title="Sin plantas registradas"
              />
            )}
            {isGovernment || isAdmin ? (
              <div className={styles.floorForm}>
                <SectionHeader
                  description="Cada planta recalcula automaticamente el area total construida."
                  eyebrow="Gobierno/Admin"
                  title="Agregar planta"
                />
                <PropertyFloorForm propertyId={property.id} propertySlug={property.slug} />
              </div>
            ) : null}
          </CrudPanel>
        </CrudWorkspace>

        <CrudWorkspace>
          <CrudPanel title="Propietarios">
            {ownerRows.length ? (
              <Table
                columns={[
                  { key: "owner", label: "Propietario" },
                  { key: "percent", label: "Porcentaje" },
                  { key: "acquiredAt", label: "Desde" },
                  { key: "role", label: "Permiso" }
                ]}
                getRowKey={(row) => row.id}
                rows={ownerRows}
              />
            ) : (
              <EmptyState
                description="No hay propietarios registrados para esta propiedad."
                icon={Landmark}
                title="Sin propietarios"
              />
            )}
          </CrudPanel>
        </CrudWorkspace>

        <CrudWorkspace
          sidebar={
            <CrudPanel title="Subastas activas">
              {auctionRows.length ? (
                <Table
                  columns={[
                    { key: "title", label: "Subasta" },
                    { key: "percent", label: "%" },
                    { key: "price", label: "Inicio" },
                    { key: "endsAt", label: "Cierre" }
                  ]}
                  getRowKey={(row) => row.id}
                  rows={auctionRows}
                />
              ) : (
                <EmptyState
                  description="No hay subastas activas relacionadas."
                  icon={Gavel}
                  title="Sin subastas"
                />
              )}
            </CrudPanel>
          }
        >
          <CrudPanel title="Ventas activas">
            {listingRows.length ? (
              <Table
                columns={[
                  { key: "title", label: "Venta" },
                  { key: "percent", label: "%" },
                  { key: "price", label: "Precio" },
                  { key: "status", label: "Estado" },
                  { key: "date", label: "Publicada" }
                ]}
                getRowKey={(row) => row.id}
                rows={listingRows}
              />
            ) : (
              <EmptyState
                description="No hay ventas activas relacionadas con esta propiedad."
                icon={HandCoins}
                title="Sin ventas"
              />
            )}
          </CrudPanel>
        </CrudWorkspace>

        <CrudPanel title="Historial de valoraciones">
          {valuationRows.length ? (
            <Table
              columns={[
                { key: "value", label: "Valor" },
                { key: "reason", label: "Razon" },
                { key: "date", label: "Fecha" }
              ]}
              getRowKey={(row) => row.id}
              rows={valuationRows}
            />
          ) : (
            <EmptyState
              description="Cuando el gobierno registre valoraciones, se mostraran aqui con razon y fecha."
              icon={ClipboardCheck}
              title="Sin valoraciones"
            />
          )}
        </CrudPanel>
      </CrudLayout>
    </main>
  );
}
