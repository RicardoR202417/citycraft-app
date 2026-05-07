import {
  ArrowLeft,
  ClipboardCheck,
  Eye,
  Gavel,
  HandCoins,
  History,
  LandPlot,
  MapPinned,
  Percent,
  Repeat2,
  Wrench
} from "lucide-react";
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
} from "../../../components/ui";
import {
  calculateDistrictAppreciation,
  formatAppreciationRate,
  formatAppreciationTrend,
  getAppreciationTrendTone
} from "../../../lib/appreciation";
import { requireProfile } from "../../../lib/auth";
import { formatMoney } from "../../../lib/economy";
import { createSupabaseServerClient, getSupabaseServiceClient } from "../../../lib/supabase/server";
import { PermitRequestForm } from "./PermitRequestForm";
import styles from "./page.module.css";

export const metadata = {
  title: "Mis propiedades - CityCraft App"
};

const PROPERTY_TYPES = [
  ["land", "Terreno"],
  ["residential", "Habitacional"],
  ["commercial", "Local"],
  ["corporate", "Corporativo"],
  ["cultural", "Cultural"],
  ["entertainment", "Entretenimiento"],
  ["infrastructure", "Infraestructura"],
  ["service", "Servicio"],
  ["public", "Publica"]
];

const PROPERTY_STATUSES = [
  ["planned", "Planeada"],
  ["active", "Activa"],
  ["under_review", "En revision"],
  ["demolished", "Demolida"],
  ["archived", "Archivada"]
];

function formatPropertyType(type) {
  return PROPERTY_TYPES.find(([value]) => value === type)?.[1] || type;
}

function formatPropertyStatus(status) {
  return PROPERTY_STATUSES.find(([value]) => value === status)?.[1] || status;
}

function getPropertyStatusTone(status) {
  const tones = {
    active: "success",
    archived: "neutral",
    demolished: "danger",
    planned: "info",
    under_review: "warning"
  };

  return tones[status] || "neutral";
}

function formatRequestType(type) {
  const labels = {
    construction: "Construccion",
    demolition: "Demolicion",
    modification: "Modificacion"
  };

  return labels[type] || type;
}

function formatPermitStatus(status) {
  const labels = {
    approved: "Aprobada",
    pending: "Pendiente",
    rejected: "Rechazada"
  };

  return labels[status] || status;
}

function getPermitStatusTone(status) {
  const tones = {
    approved: "success",
    pending: "warning",
    rejected: "danger"
  };

  return tones[status] || "neutral";
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

function formatSignedMoney(value) {
  const amount = Number(value || 0);
  const sign = amount > 0 ? "+" : "";

  return `${sign}${formatMoney(amount)}`;
}

function getParam(params, key) {
  const value = params?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function matchesText(property, query) {
  if (!query) {
    return true;
  }

  const text = [
    property.name,
    property.address,
    property.districts?.name
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return text.includes(query.toLowerCase());
}

function isPubliclyVisible(property) {
  return property.status === "active" || property.status === "planned";
}

export default async function PropertiesPage({ searchParams }) {
  const params = await searchParams;
  const query = getParam(params, "q");
  const typeFilter = getParam(params, "type");
  const districtFilter = getParam(params, "district");
  const statusFilter = getParam(params, "status");
  const profile = await requireProfile("/properties");
  const supabase = await createSupabaseServerClient();
  const serviceSupabase = getSupabaseServiceClient();

  const { data: ownerships = [] } = await supabase
    .from("property_owners")
    .select(
      `
        id,
        ownership_percent,
        properties (
          id,
          district_id,
          slug,
          name,
          address,
          type,
          status,
          size_blocks,
          current_value,
          districts (id, name, slug)
        )
      `
    )
    .eq("profile_id", profile.id)
    .order("acquired_at", { ascending: false });

  const ownedProperties = ownerships.map((ownership) => ownership.properties).filter(Boolean);
  const ownedPropertyIds = ownedProperties.map((property) => property.id);
  const ownedDistrictIds = [...new Set(ownedProperties.map((property) => property.district_id).filter(Boolean))];

  const [
    { data: districts = [] },
    { data: districtProperties = [] },
    { data: propertyOwners = [] },
    { data: appreciationHistory = [] },
    { data: valuationHistory = [] },
    { data: permitRequests = [] }
  ] = await Promise.all([
    supabase.from("districts").select("id, name, slug, description, base_appreciation_rate").order("name"),
    supabase.from("properties").select("id, district_id, type, status, size_blocks, current_value, created_at, updated_at"),
    serviceSupabase.from("property_owners").select("property_id, owner_type, profile_id, organization_id, ownership_percent"),
    serviceSupabase
      .from("district_appreciation_history")
      .select("id, district_id, previous_index, new_index, change_amount, reason, factors, created_at")
      .in("district_id", ownedDistrictIds.length ? ownedDistrictIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false })
      .limit(200),
    ownedPropertyIds.length
      ? serviceSupabase
          .from("property_valuations")
          .select("id, property_id, value, reason, created_at")
          .in("property_id", ownedPropertyIds)
          .order("created_at", { ascending: false })
          .limit(200)
      : { data: [] },
    supabase
      .from("property_permit_requests")
      .select(
        "id, property_id, request_type, title, status, proposed_type, proposed_size_blocks, proposed_value, government_comment, created_at, decided_at, properties(name)"
      )
      .eq("requested_by_profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  const latestAppreciationByDistrict = new Map();

  for (const record of appreciationHistory) {
    if (!latestAppreciationByDistrict.has(record.district_id)) {
      latestAppreciationByDistrict.set(record.district_id, record);
    }
  }

  const valuationsByProperty = new Map();

  for (const valuation of valuationHistory) {
    valuationsByProperty.set(valuation.property_id, [
      ...(valuationsByProperty.get(valuation.property_id) || []),
      valuation
    ]);
  }

  const districtMetricsById = new Map(
    districts.map((district) => [
      district.id,
      calculateDistrictAppreciation(district, districtProperties, {
        owners: propertyOwners,
        previousIndex: latestAppreciationByDistrict.get(district.id)?.new_index
      })
    ])
  );

  const filteredOwnerships = ownerships.filter((ownership) => {
    const property = ownership.properties;

    if (!property) {
      return false;
    }

    return (
      matchesText(property, query) &&
      (!typeFilter || property.type === typeFilter) &&
      (!districtFilter || property.district_id === districtFilter) &&
      (!statusFilter || property.status === statusFilter)
    );
  });

  const totalValue = ownerships.reduce((sum, ownership) => {
    const value = Number(ownership.properties?.current_value || 0);
    return sum + value * (Number(ownership.ownership_percent || 0) / 100);
  }, 0);

  const filteredValue = filteredOwnerships.reduce((sum, ownership) => {
    const value = Number(ownership.properties?.current_value || 0);
    return sum + value * (Number(ownership.ownership_percent || 0) / 100);
  }, 0);

  const rows = filteredOwnerships.map((ownership) => {
    const property = ownership.properties || {};
    const percent = Number(ownership.ownership_percent || 0);
    const proportionalValue = Number(property.current_value || 0) * (percent / 100);
    const isMajorityOwner = percent > 50;
    const canOperateOwnership = percent > 0;

    return {
      id: ownership.id,
      property: (
        <div className={styles.propertyName}>
          <strong>{property.name}</strong>
          <span>{property.address}</span>
        </div>
      ),
      district: property.districts?.name || "Sin delegacion",
      type: <Badge tone="info">{formatPropertyType(property.type)}</Badge>,
      percent: formatPercent(percent),
      value: formatMoney(proportionalValue),
      visibility: (
        <Badge tone={isPubliclyVisible(property) ? "success" : "neutral"}>
          {isPubliclyVisible(property) ? "Visible" : "No visible"}
        </Badge>
      ),
      status: <Badge tone={getPropertyStatusTone(property.status)}>{formatPropertyStatus(property.status)}</Badge>,
      actions: (
        <CrudActionList
          aria-label={`Acciones para ${property.name}`}
          actions={[
            {
              href: `/properties/${property.slug}`,
              icon: Eye,
              label: "Detalle"
            },
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
              label: "Modificar"
            },
            {
              disabled: !canOperateOwnership,
              icon: Repeat2,
              label: isMajorityOwner ? "Transferir" : "Transferir %",
              variant: "secondary"
            }
          ]}
        />
      )
    };
  });

  const propertyOptions = ownerships
    .map((ownership) => ownership.properties)
    .filter(Boolean)
    .map((property) => ({
      id: property.id,
      name: property.name
    }));

  const permitRows = permitRequests.map((request) => ({
    id: request.id,
    request: (
      <div className={styles.propertyName}>
        <strong>{request.title}</strong>
        <span>{request.properties?.name || "Propiedad no disponible"}</span>
      </div>
    ),
    type: <Badge tone="info">{formatRequestType(request.request_type)}</Badge>,
    status: <Badge tone={getPermitStatusTone(request.status)}>{formatPermitStatus(request.status)}</Badge>,
    proposed: (
      <div className={styles.propertyName}>
        <span>{request.proposed_type ? `Tipo: ${formatPropertyType(request.proposed_type)}` : "Tipo: sin cambio"}</span>
        <span>
          {request.proposed_size_blocks
            ? `Bloques: ${Number(request.proposed_size_blocks).toLocaleString("es-MX")}`
            : "Bloques: sin cambio"}
        </span>
        <span>{request.proposed_value !== null ? `Valor: ${formatMoney(request.proposed_value)}` : "Valor: sin cambio"}</span>
      </div>
    ),
    comment: request.government_comment || "Pendiente de revision",
    createdAt: formatDate(request.created_at),
    decidedAt: formatDate(request.decided_at)
  }));

  const valueExplanationRows = filteredOwnerships.map((ownership) => {
    const property = ownership.properties || {};
    const percent = Number(ownership.ownership_percent || 0);
    const propertyValuations = valuationsByProperty.get(property.id) || [];
    const latestValuation = propertyValuations[0];
    const previousValuation = propertyValuations[1];
    const currentValue = Number(property.current_value || latestValuation?.value || 0);
    const previousValue = previousValuation ? Number(previousValuation.value || 0) : null;
    const proportionalCurrent = currentValue * (percent / 100);
    const proportionalPrevious = previousValue !== null ? previousValue * (percent / 100) : null;
    const proportionalDelta = proportionalPrevious !== null ? proportionalCurrent - proportionalPrevious : null;
    const latestAppreciation = property.district_id ? latestAppreciationByDistrict.get(property.district_id) : null;
    const appreciationChange = Number(latestAppreciation?.change_amount || 0);
    const appreciationImpact = currentValue * (percent / 100) * (appreciationChange / 100);

    return {
      id: ownership.id,
      property: (
        <div className={styles.propertyName}>
          <strong>{property.name || "Propiedad no disponible"}</strong>
          <span>{property.districts?.name || "Sin delegacion"}</span>
        </div>
      ),
      currentValue: formatMoney(proportionalCurrent),
      valueChange:
        proportionalDelta !== null ? (
          <Badge tone={proportionalDelta > 0 ? "success" : proportionalDelta < 0 ? "danger" : "neutral"}>
            {formatSignedMoney(proportionalDelta)}
          </Badge>
        ) : (
          <Badge tone="neutral">Sin cambio previo</Badge>
        ),
      appreciation: latestAppreciation ? (
        <div className={styles.propertyName}>
          <strong>{formatAppreciationRate(appreciationChange)}</strong>
          <span>{latestAppreciation.reason}</span>
        </div>
      ) : (
        "Sin snapshot"
      ),
      estimatedImpact: latestAppreciation ? (
        <Badge tone={appreciationImpact > 0 ? "success" : appreciationImpact < 0 ? "danger" : "neutral"}>
          {formatSignedMoney(appreciationImpact)}
        </Badge>
      ) : (
        <Badge tone="neutral">No calculado</Badge>
      ),
      audit: latestValuation ? (
        <div className={styles.propertyName}>
          <strong>{latestValuation.reason}</strong>
          <span>{formatDate(latestValuation.created_at)}</span>
        </div>
      ) : (
        "Sin historial"
      )
    };
  });

  const summaryItems = [
    { label: "Propiedades directas", value: ownerships.length },
    { label: "Resultados visibles", value: filteredOwnerships.length },
    { label: "Valor total directo", value: formatMoney(totalValue) },
    { label: "Valor filtrado", value: formatMoney(filteredValue) },
    {
      label: "Delegaciones",
      value: new Set(ownerships.map((ownership) => ownership.properties?.district_id).filter(Boolean)).size
    }
  ];

  const ownedDistricts = Array.from(
    new Map(
      ownerships
        .map((ownership) => ownership.properties)
        .filter((property) => property?.district_id)
        .map((property) => [property.district_id, property.districts])
    ).entries()
  ).map(([districtId, district]) => ({
    id: districtId,
    name: district?.name || "Sin delegacion",
    metrics: districtMetricsById.get(districtId)
  }));

  return (
    <main className={styles.page}>
      <PageHeader
        actions={
          <LinkButton href="/dashboard" icon={ArrowLeft} variant="secondary">
            Dashboard
          </LinkButton>
        }
        description="Busca, filtra, abre detalle y prepara acciones sobre las propiedades registradas directamente a tu nombre."
        eyebrow="CRUD centralizado"
        title="Mis propiedades"
      />

      <CrudLayout>
        <CrudToolbar
          actions={
            <LinkButton href="#permit-request" icon={ClipboardCheck} size="sm">
              Solicitar modificacion
            </LinkButton>
          }
          filters={[
            {
              defaultValue: typeFilter,
              label: "Tipo",
              name: "type",
              options: [
                { label: "Todos", value: "" },
                ...PROPERTY_TYPES.map(([value, label]) => ({ label, value }))
              ]
            },
            {
              defaultValue: districtFilter,
              label: "Delegacion",
              name: "district",
              options: [
                { label: "Todas", value: "" },
                ...districts.map((district) => ({ label: district.name, value: district.id }))
              ]
            },
            {
              defaultValue: statusFilter,
              label: "Estado",
              name: "status",
              options: [
                { label: "Todos", value: "" },
                ...PROPERTY_STATUSES.map(([value, label]) => ({ label, value }))
              ]
            }
          ]}
          searchDefaultValue={query}
          searchPlaceholder="Buscar por nombre, direccion o delegacion"
        />

        <CrudWorkspace
          sidebar={
            <>
              <CrudPanel title="Resumen">
                <DataList items={summaryItems} />
              </CrudPanel>
              <CrudPanel title="Valor proporcional">
                <div className={styles.valuePanel}>
                  <Percent size={22} />
                  <strong>{formatMoney(filteredValue)}</strong>
                  <span>Valor directo de resultados filtrados</span>
                </div>
              </CrudPanel>
            </>
          }
        >
          <CrudPanel title="Registro centralizado">
            {filteredOwnerships.length ? (
              <Table
                columns={[
                  { key: "property", label: "Propiedad" },
                  { key: "district", label: "Delegacion" },
                  { key: "type", label: "Tipo" },
                  { key: "percent", label: "Mi porcentaje" },
                  { key: "value", label: "Valor proporcional" },
                  { key: "visibility", label: "Visibilidad" },
                  { key: "status", label: "Estado" },
                  { key: "actions", label: "Acciones" }
                ]}
                getRowKey={(row) => row.id}
                rows={rows}
              />
            ) : (
              <EmptyState
                action={
                  <LinkButton href="/properties" icon={LandPlot} variant="secondary">
                    Limpiar filtros
                  </LinkButton>
                }
                description="No hay propiedades que coincidan con la busqueda actual."
                icon={LandPlot}
                title="Sin resultados"
              />
            )}
          </CrudPanel>
        </CrudWorkspace>

        <CrudWorkspace
          sidebar={
            <CrudPanel title="Mis zonas">
              {ownedDistricts.length ? (
                <div className={styles.zoneGrid}>
                  {ownedDistricts.map((district) => (
                    <article key={district.id}>
                      <MapPinned size={18} />
                      <div>
                        <strong>{district.name}</strong>
                        <span>{formatAppreciationRate(district.metrics?.currentRate)} indice actual</span>
                      </div>
                      <Badge tone={getAppreciationTrendTone(district.metrics?.trend)}>
                        {formatAppreciationTrend(district.metrics?.trend)}
                      </Badge>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  description="Cuando tengas propiedades, tambien veras aqui la plusvalia de sus delegaciones."
                  icon={MapPinned}
                  title="Sin zonas"
                />
              )}
            </CrudPanel>
          }
        >
          <CrudPanel title="Auditoria de valor">
            <SectionHeader
              description="Cruza historial de valoraciones con el ultimo snapshot de plusvalia de la delegacion."
              eyebrow="Valor"
              title="Por que cambio mi valor"
            />
            {valueExplanationRows.length ? (
              <Table
                columns={[
                  { key: "property", label: "Propiedad" },
                  { key: "currentValue", label: "Valor actual" },
                  { key: "valueChange", label: "Cambio" },
                  { key: "appreciation", label: "Plusvalia zona" },
                  { key: "estimatedImpact", label: "Impacto estimado" },
                  { key: "audit", label: "Ultima valoracion" }
                ]}
                getRowKey={(row) => row.id}
                rows={valueExplanationRows}
              />
            ) : (
              <EmptyState
                description="Cuando tengas propiedades y valoraciones registradas, apareceran aqui las razones de cambio."
                icon={History}
                title="Sin historial de valor"
              />
            )}
          </CrudPanel>
        </CrudWorkspace>

        <CrudWorkspace
          sidebar={
            <CrudPanel title="Nueva solicitud">
              <div id="permit-request" />
              <PermitRequestForm properties={propertyOptions} />
            </CrudPanel>
          }
        >
          <CrudPanel title="Solicitudes recientes">
            <SectionHeader
              description="Seguimiento de solicitudes enviadas al gobierno y su decision."
              eyebrow="Permisos"
              title="Historial"
            />
            {permitRows.length ? (
              <Table
                columns={[
                  { key: "request", label: "Solicitud" },
                  { key: "type", label: "Tipo" },
                  { key: "status", label: "Estado" },
                  { key: "proposed", label: "Propuesta" },
                  { key: "comment", label: "Comentario gobierno" },
                  { key: "createdAt", label: "Creada" },
                  { key: "decidedAt", label: "Decision" }
                ]}
                getRowKey={(row) => row.id}
                rows={permitRows}
              />
            ) : (
              <EmptyState
                description="Cuando envies solicitudes de construccion o modificacion, podras darles seguimiento aqui."
                icon={ClipboardCheck}
                title="Sin solicitudes"
              />
            )}
          </CrudPanel>
        </CrudWorkspace>
      </CrudLayout>

      <Card className={styles.noteCard}>
        <SectionHeader
          description="Las propiedades de organizaciones donde participas se conectaran cuando avancemos el modulo de organizaciones."
          eyebrow="Privacidad"
          title="Alcance de esta vista"
        />
      </Card>
    </main>
  );
}
