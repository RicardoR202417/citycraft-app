import { ArrowLeft, Building2, LandPlot, MapPinned, ReceiptText, UsersRound } from "lucide-react";
import { Badge, Card, DataList, EmptyState, LinkButton, PageHeader, SectionHeader, Table } from "../../../../components/ui";
import { requireGlobalAdminProfile } from "../../../../lib/auth";
import { formatMoney } from "../../../../lib/economy";
import { getSupabaseServiceClient } from "../../../../lib/supabase/server";
import {
  AddPropertyOwnerForm,
  AdminPropertyForm,
  RemovePropertyOwnerForm,
  UpdatePropertyOwnerForm
} from "./AdminPropertyForms";
import styles from "./page.module.css";

export const metadata = {
  title: "Propiedades - Admin - CityCraft App"
};

function formatDate(value) {
  if (!value) {
    return "Pendiente";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium"
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

function getOwnerName(owner) {
  if (owner.owner_type === "profile") {
    return owner.profiles?.display_name || owner.profiles?.gamertag || "Jugador no disponible";
  }

  return owner.organizations?.name || "Organizacion no disponible";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export default async function AdminPropertiesPage() {
  await requireGlobalAdminProfile("/admin/properties");
  const serviceSupabase = getSupabaseServiceClient();

  const [
    { data: propertiesData = [] },
    { data: ownersData = [] },
    { data: valuationsData = [] },
    { data: districtsData = [] },
    { data: playersData = [] },
    { data: organizationsData = [] }
  ] = await Promise.all([
    serviceSupabase
      .from("properties")
      .select("id, district_id, parent_property_id, name, slug, address, type, status, size_blocks, current_value, description, created_at, districts(name)")
      .order("created_at", { ascending: false }),
    serviceSupabase
      .from("property_owners")
      .select(
        "id, property_id, owner_type, profile_id, organization_id, ownership_percent, acquired_at, profiles!property_owners_profile_id_fkey(gamertag, display_name), organizations!property_owners_organization_id_fkey(name, type)"
      )
      .order("created_at", { ascending: true }),
    serviceSupabase
      .from("property_valuations")
      .select("id, property_id, value, reason, created_at, profiles!property_valuations_created_by_fkey(gamertag)")
      .order("created_at", { ascending: false }),
    serviceSupabase
      .from("districts")
      .select("id, name")
      .order("name", { ascending: true }),
    serviceSupabase
      .from("profiles")
      .select("id, gamertag, display_name")
      .order("gamertag", { ascending: true }),
    serviceSupabase
      .from("organizations")
      .select("id, name, type")
      .order("type", { ascending: true })
      .order("name", { ascending: true })
  ]);

  const properties = asArray(propertiesData);
  const owners = asArray(ownersData);
  const valuations = asArray(valuationsData);
  const districts = asArray(districtsData);
  const players = asArray(playersData);
  const organizations = asArray(organizationsData);
  const propertyNameById = new Map(properties.map((property) => [property.id, property.name]));
  const ownersByProperty = new Map();
  const valuationsByProperty = new Map();
  const parentProperties = properties.filter((property) => !property.parent_property_id);

  for (const owner of owners) {
    ownersByProperty.set(owner.property_id, [...(ownersByProperty.get(owner.property_id) || []), owner]);
  }

  for (const valuation of valuations) {
    valuationsByProperty.set(valuation.property_id, [...(valuationsByProperty.get(valuation.property_id) || []), valuation]);
  }

  return (
    <main className={styles.page}>
      <PageHeader
        actions={
          <LinkButton href="/admin" icon={ArrowLeft} variant="secondary">
            Admin
          </LinkButton>
        }
        description="Correccion central de propiedades, propietarios y porcentajes. Las valoraciones se consultan aqui; el cambio de valor sigue por flujo auditable de gobierno."
        eyebrow="Administracion global"
        title="Propiedades y propietarios"
      />

      {properties.length ? (
        <section className={styles.properties}>
          {properties.map((property) => {
            const propertyOwners = ownersByProperty.get(property.id) || [];
            const propertyValuations = (valuationsByProperty.get(property.id) || []).slice(0, 3);
            const assignedPercent = propertyOwners.reduce((total, owner) => total + Number(owner.ownership_percent || 0), 0);
            const summaryItems = [
              { label: "Slug", value: property.slug },
              { label: "Delegacion", value: property.districts?.name || "Sin delegacion" },
              { label: "Matriz", value: property.parent_property_id ? propertyNameById.get(property.parent_property_id) || "No disponible" : "No aplica" },
              { label: "Valor actual", value: formatMoney(property.current_value) },
              { label: "Bloques", value: Number(property.size_blocks || 0).toLocaleString("es-MX") },
              {
                label: "Propiedad asignada",
                value: `${assignedPercent.toLocaleString("es-MX", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}%`
              }
            ];
            const ownerRows = propertyOwners.map((owner) => ({
              id: owner.id,
              owner: (
                <div className={styles.nameCell}>
                  <strong>{getOwnerName(owner)}</strong>
                  <span>{owner.owner_type === "profile" ? "Jugador" : "Organizacion"}</span>
                </div>
              ),
              percent: `${Number(owner.ownership_percent || 0).toLocaleString("es-MX", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}%`,
              acquiredAt: formatDate(owner.acquired_at),
              update: <UpdatePropertyOwnerForm owner={owner} />,
              remove: <RemovePropertyOwnerForm owner={owner} />
            }));
            const valuationRows = propertyValuations.map((valuation) => ({
              id: valuation.id,
              value: formatMoney(valuation.value),
              reason: valuation.reason,
              actor: valuation.profiles?.gamertag || "Sistema",
              createdAt: formatDate(valuation.created_at)
            }));

            return (
              <Card className={styles.propertyCard} key={property.id}>
                <div className={styles.propertyHeader}>
                  <div>
                    <span>
                      <LandPlot size={18} />
                      Propiedad
                    </span>
                    <h2>{property.name}</h2>
                  </div>
                  <div className={styles.badges}>
                    <Badge tone="info">{formatPropertyType(property.type)}</Badge>
                    <Badge tone={getStatusTone(property.status)}>{formatPropertyStatus(property.status)}</Badge>
                    <Badge tone={property.parent_property_id ? "warning" : "success"}>
                      {property.parent_property_id ? "Unidad privativa" : "Matriz"}
                    </Badge>
                  </div>
                </div>

                <div className={styles.propertyGrid}>
                  <div>
                    <SectionHeader
                      eyebrow="Resumen"
                      title="Datos actuales"
                      description={property.address}
                    />
                    <DataList items={summaryItems} />
                  </div>
                  <div>
                    <SectionHeader
                      eyebrow="Edicion"
                      title="Datos administrativos"
                      description="No modifica el historial de valoracion; para cambio de valor usa el flujo de gobierno."
                    />
                    <AdminPropertyForm
                      districts={districts}
                      parentProperties={parentProperties}
                      property={property}
                    />
                  </div>
                </div>

                <div className={styles.managementGrid}>
                  <div>
                    <SectionHeader
                      eyebrow="Propietarios"
                      title="Participaciones"
                      description="El total no puede superar 100%. Cada cambio queda auditado."
                    />
                    {ownerRows.length ? (
                      <Table
                        columns={[
                          { key: "owner", label: "Propietario" },
                          { key: "percent", label: "%" },
                          { key: "acquiredAt", label: "Desde" },
                          { key: "update", label: "Ajustar" },
                          { key: "remove", label: "Remover" }
                        ]}
                        getRowKey={(row) => row.id}
                        rows={ownerRows}
                      />
                    ) : (
                      <EmptyState
                        description="Esta propiedad no tiene propietario asignado."
                        icon={UsersRound}
                        title="Sin propietarios"
                      />
                    )}
                  </div>

                  <div>
                    <SectionHeader
                      eyebrow="Alta"
                      title="Agregar propietario"
                      description="Selecciona jugador u organizacion y asigna porcentaje."
                    />
                    <AddPropertyOwnerForm
                      organizations={organizations}
                      players={players}
                      property={property}
                    />
                  </div>
                </div>

                <div className={styles.valuationsBlock}>
                  <SectionHeader
                    eyebrow="Valoraciones"
                    title="Historial reciente"
                    description="Consulta de las ultimas valoraciones registradas para esta propiedad."
                  />
                  {valuationRows.length ? (
                    <Table
                      columns={[
                        { key: "value", label: "Valor" },
                        { key: "reason", label: "Razon" },
                        { key: "actor", label: "Registro" },
                        { key: "createdAt", label: "Fecha" }
                      ]}
                      getRowKey={(row) => row.id}
                      rows={valuationRows}
                    />
                  ) : (
                    <EmptyState
                      description="Aun no hay valoraciones registradas para esta propiedad."
                      icon={ReceiptText}
                      title="Sin valoraciones"
                    />
                  )}
                </div>
              </Card>
            );
          })}
        </section>
      ) : (
        <Card className={styles.emptyCard}>
          <EmptyState
            description="Cuando gobierno registre propiedades, apareceran aqui para correccion administrativa."
            icon={MapPinned}
            title="No hay propiedades registradas"
          />
        </Card>
      )}

      <Card className={styles.noteCard}>
        <SectionHeader
          eyebrow="Separacion de roles"
          title="Admin global y gobierno"
          description="El administrador corrige datos y propietarios; el gobierno mantiene el flujo operativo de altas, permisos y nuevas valoraciones."
        />
        <div className={styles.note}>
          <Building2 size={18} />
          <span>Las correcciones administrativas no reemplazan las decisiones publicas del gobierno.</span>
        </div>
      </Card>
    </main>
  );
}
