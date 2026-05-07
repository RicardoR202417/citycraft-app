import { ArrowLeft, Building2, Eye, LandPlot, MapPinned, ReceiptText, Trash2, UsersRound, Wrench } from "lucide-react";
import {
  Badge,
  Card,
  CrudActionList,
  CrudLayout,
  CrudPanel,
  CrudToolbar,
  CrudWorkspace,
  DataList,
  EmptyState,
  LinkButton,
  PageHeader,
  SectionHeader,
  Table
} from "../../../../components/ui";
import { requireGlobalAdminProfile } from "../../../../lib/auth";
import { formatMoney } from "../../../../lib/economy";
import { getSupabaseServiceClient } from "../../../../lib/supabase/server";
import {
  AddPropertyOwnerForm,
  AdminPropertyForm,
  DeletePropertyForm,
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

export default async function AdminPropertiesPage({ searchParams }) {
  await requireGlobalAdminProfile("/admin/properties");
  const params = await searchParams;
  const propertySearch = typeof params?.admin_property_q === "string" ? params.admin_property_q.trim() : "";
  const propertyTypeFilter = typeof params?.admin_property_type === "string" ? params.admin_property_type : "";
  const propertyDistrictFilter = typeof params?.admin_property_district === "string" ? params.admin_property_district : "";
  const propertyStatusFilter = typeof params?.admin_property_status === "string" ? params.admin_property_status : "";
  const selectedPropertyId = typeof params?.admin_property_id === "string" ? params.admin_property_id : "";
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
      .select("id, district_id, parent_property_id, name, slug, address, type, status, size_blocks, land_area_blocks, building_area_blocks, current_value, description, created_at, districts(name)")
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
  const filteredProperties = properties.filter((property) => {
    const searchNeedle = propertySearch.toLowerCase();
    const matchesSearch =
      !searchNeedle ||
      [property.name, property.slug, property.address, property.districts?.name]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(searchNeedle));
    const matchesType = !propertyTypeFilter || property.type === propertyTypeFilter;
    const matchesDistrict = !propertyDistrictFilter || property.district_id === propertyDistrictFilter;
    const matchesStatus = !propertyStatusFilter || property.status === propertyStatusFilter;

    return matchesSearch && matchesType && matchesDistrict && matchesStatus;
  });
  const selectedProperty =
    properties.find((property) => property.id === selectedPropertyId) ||
    filteredProperties[0] ||
    properties[0] ||
    null;

  for (const owner of owners) {
    ownersByProperty.set(owner.property_id, [...(ownersByProperty.get(owner.property_id) || []), owner]);
  }

  for (const valuation of valuations) {
    valuationsByProperty.set(valuation.property_id, [...(valuationsByProperty.get(valuation.property_id) || []), valuation]);
  }

  const propertyTypeOptions = [
    { label: "Todos los tipos", value: "" },
    { label: "Terreno", value: "land" },
    { label: "Habitacional", value: "residential" },
    { label: "Local", value: "commercial" },
    { label: "Corporativo", value: "corporate" },
    { label: "Cultural", value: "cultural" },
    { label: "Entretenimiento", value: "entertainment" },
    { label: "Infraestructura", value: "infrastructure" },
    { label: "Servicio", value: "service" },
    { label: "Publica", value: "public" }
  ];
  const propertyStatusOptions = [
    { label: "Todos los estados", value: "" },
    { label: "Planeada", value: "planned" },
    { label: "Activa", value: "active" },
    { label: "En revision", value: "under_review" },
    { label: "Demolida", value: "demolished" },
    { label: "Archivada", value: "archived" }
  ];
  const propertyDistrictOptions = [
    { label: "Todas las delegaciones", value: "" },
    ...districts.map((district) => ({
      label: district.name,
      value: district.id
    }))
  ];
  const selectedOwners = selectedProperty ? ownersByProperty.get(selectedProperty.id) || [] : [];
  const selectedValuations = selectedProperty ? (valuationsByProperty.get(selectedProperty.id) || []).slice(0, 5) : [];
  const selectedAssignedPercent = selectedOwners.reduce((total, owner) => total + Number(owner.ownership_percent || 0), 0);
  const selectedSummaryItems = selectedProperty
    ? [
        { label: "Slug", value: selectedProperty.slug },
        { label: "Delegacion", value: selectedProperty.districts?.name || "Sin delegacion" },
        {
          label: "Matriz",
          value: selectedProperty.parent_property_id ? propertyNameById.get(selectedProperty.parent_property_id) || "No disponible" : "No aplica"
        },
        { label: "Valor actual", value: formatMoney(selectedProperty.current_value) },
        { label: "Terreno", value: Number(selectedProperty.land_area_blocks || selectedProperty.size_blocks || 0).toLocaleString("es-MX") },
        { label: "Construccion", value: Number(selectedProperty.building_area_blocks || 0).toLocaleString("es-MX") },
        {
          label: "Propiedad asignada",
          value: `${selectedAssignedPercent.toLocaleString("es-MX", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}%`
        }
      ]
    : [];
  const propertyRows = filteredProperties.map((property) => ({
    id: property.id,
    property: (
      <div className={styles.nameCell}>
        <strong>{property.name}</strong>
        <span>{property.address}</span>
      </div>
    ),
    district: property.districts?.name || "Sin delegacion",
    type: <Badge tone="info">{formatPropertyType(property.type)}</Badge>,
    status: <Badge tone={getStatusTone(property.status)}>{formatPropertyStatus(property.status)}</Badge>,
    kind: (
      <Badge tone={property.parent_property_id ? "warning" : "success"}>
        {property.parent_property_id ? "Unidad privativa" : "Matriz"}
      </Badge>
    ),
    ownerPercent: `${(ownersByProperty.get(property.id) || [])
      .reduce((total, owner) => total + Number(owner.ownership_percent || 0), 0)
      .toLocaleString("es-MX", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}%`,
    value: formatMoney(property.current_value),
    actions: (
      <CrudActionList
        actions={[
          {
            href: `/properties/${property.slug}`,
            icon: Eye,
            key: `${property.id}-detail`,
            label: "Detalle"
          },
          {
            href: `/admin/properties?admin_property_id=${property.id}`,
            icon: Wrench,
            key: `${property.id}-manage`,
            label: "Gestionar"
          }
        ]}
        aria-label={`Acciones admin para ${property.name}`}
      />
    )
  }));
  const ownerRows = selectedOwners.map((owner) => ({
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
  const valuationRows = selectedValuations.map((valuation) => ({
    id: valuation.id,
    value: formatMoney(valuation.value),
    reason: valuation.reason,
    actor: valuation.profiles?.gamertag || "Sistema",
    createdAt: formatDate(valuation.created_at)
  }));

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

      <CrudLayout>
        <CrudToolbar
          actions={
            selectedProperty ? (
              <CrudActionList
                actions={[
                  {
                    href: `/properties/${selectedProperty.slug}`,
                    icon: Eye,
                    key: "detail",
                    label: "Ver detalle"
                  },
                  {
                    href: "#admin-danger-zone",
                    icon: Trash2,
                    key: "delete",
                    label: "Eliminar",
                    variant: "danger"
                  }
                ]}
              />
            ) : null
          }
          filters={[
            {
              defaultValue: propertyTypeFilter,
              label: "Tipo",
              name: "admin_property_type",
              options: propertyTypeOptions
            },
            {
              defaultValue: propertyDistrictFilter,
              label: "Delegacion",
              name: "admin_property_district",
              options: propertyDistrictOptions
            },
            {
              defaultValue: propertyStatusFilter,
              label: "Estado",
              name: "admin_property_status",
              options: propertyStatusOptions
            }
          ]}
          searchDefaultValue={propertySearch}
          searchLabel="Buscar propiedad"
          searchName="admin_property_q"
          searchPlaceholder="Nombre, direccion, slug o delegacion"
        />

        {properties.length ? (
          <CrudWorkspace
            sidebar={
              selectedProperty ? (
                <>
                  <CrudPanel title="Edicion administrativa">
                    <SectionHeader
                      eyebrow="Propiedad seleccionada"
                      title={selectedProperty.name}
                      description="Admin puede corregir datos operativos y estructura matriz/unidad."
                    />
                    <AdminPropertyForm
                      districts={districts}
                      parentProperties={parentProperties}
                      property={selectedProperty}
                    />
                  </CrudPanel>

                  <CrudPanel title="Alta de propietario">
                    <SectionHeader
                      eyebrow="Participacion"
                      title="Agregar propietario"
                      description="Selecciona jugador u organizacion y asigna porcentaje."
                    />
                    <AddPropertyOwnerForm
                      organizations={organizations}
                      players={players}
                      property={selectedProperty}
                    />
                  </CrudPanel>

                  <CrudPanel title="Zona peligrosa">
                    <div id="admin-danger-zone" className={styles.anchorTarget}>
                      <SectionHeader
                        eyebrow="Permiso admin"
                        title="Eliminar propiedad"
                        description="Requiere escribir el nombre exacto y queda auditado. No existe en gobierno ni jugadores."
                      />
                      <DeletePropertyForm property={selectedProperty} />
                    </div>
                  </CrudPanel>
                </>
              ) : null
            }
          >
            <Card className={styles.propertyCard}>
              <SectionHeader
                eyebrow="CRUD centralizado"
                title="Propiedades registradas"
                description={`${filteredProperties.length.toLocaleString("es-MX")} de ${properties.length.toLocaleString("es-MX")} propiedades segun filtros activos.`}
              />
              {propertyRows.length ? (
                <Table
                  columns={[
                    { key: "property", label: "Propiedad" },
                    { key: "district", label: "Delegacion" },
                    { key: "type", label: "Tipo" },
                    { key: "status", label: "Estado" },
                    { key: "kind", label: "Registro" },
                    { key: "ownerPercent", label: "% asignado" },
                    { key: "value", label: "Valor" },
                    { key: "actions", label: "Acciones" }
                  ]}
                  getRowKey={(row) => row.id}
                  rows={propertyRows}
                />
              ) : (
                <EmptyState
                  description="No hay propiedades que coincidan con los filtros activos."
                  icon={MapPinned}
                  title="Sin resultados"
                />
              )}
            </Card>

            {selectedProperty ? (
              <Card className={styles.propertyCard}>
                <div className={styles.propertyHeader}>
                  <div>
                    <span>
                      <LandPlot size={18} />
                      Propiedad seleccionada
                    </span>
                    <h2>{selectedProperty.name}</h2>
                  </div>
                  <div className={styles.badges}>
                    <Badge tone="info">{formatPropertyType(selectedProperty.type)}</Badge>
                    <Badge tone={getStatusTone(selectedProperty.status)}>{formatPropertyStatus(selectedProperty.status)}</Badge>
                    <Badge tone={selectedProperty.parent_property_id ? "warning" : "success"}>
                      {selectedProperty.parent_property_id ? "Unidad privativa" : "Matriz"}
                    </Badge>
                  </div>
                </div>

                <div className={styles.propertyGrid}>
                  <div>
                    <SectionHeader
                      eyebrow="Resumen"
                      title="Datos actuales"
                      description={selectedProperty.address}
                    />
                    <DataList items={selectedSummaryItems} />
                  </div>
                  <div>
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
                </div>

                <div className={styles.valuationsBlock}>
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
              </Card>
            ) : null}
          </CrudWorkspace>
        ) : (
          <Card className={styles.emptyCard}>
            <EmptyState
              description="Cuando gobierno registre propiedades, apareceran aqui para correccion administrativa."
              icon={MapPinned}
              title="No hay propiedades registradas"
            />
          </Card>
        )}
      </CrudLayout>

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
