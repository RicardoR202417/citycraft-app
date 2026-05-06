import { ArrowLeft, Building2, ClipboardCheck, History, LandPlot, MapPinned, Percent } from "lucide-react";
import { Badge, Card, DataList, EmptyState, LinkButton, PageHeader, SectionHeader, Table } from "../../../components/ui";
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
    timeStyle: "short"
  }).format(new Date(value));
}

function formatSignedMoney(value) {
  const amount = Number(value || 0);
  const sign = amount > 0 ? "+" : "";

  return `${sign}${formatMoney(amount)}`;
}

export default async function PropertiesPage() {
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
          name,
          address,
          type,
          size_blocks,
          current_value,
          districts (id, name)
        )
      `
    )
    .eq("profile_id", profile.id)
    .order("acquired_at", { ascending: false });

  const { data: permitRequests = [] } = await supabase
    .from("property_permit_requests")
    .select("id, property_id, request_type, title, status, proposed_type, proposed_size_blocks, proposed_value, government_comment, created_at, decided_at, properties(name)")
    .eq("requested_by_profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const ownedProperties = ownerships.map((ownership) => ownership.properties).filter(Boolean);
  const ownedPropertyIds = ownedProperties.map((property) => property.id);
  const ownedDistrictIds = [...new Set(ownedProperties.map((property) => property.district_id).filter(Boolean))];

  const [
    { data: districts = [] },
    { data: districtProperties = [] },
    { data: propertyOwners = [] },
    { data: appreciationHistory = [] },
    { data: valuationHistory = [] }
  ] = await Promise.all([
    supabase
      .from("districts")
      .select("id, name, slug, description, base_appreciation_rate"),
    supabase
      .from("properties")
      .select("id, district_id, type, status, size_blocks, current_value, created_at, updated_at"),
    serviceSupabase
      .from("property_owners")
      .select("property_id, owner_type, profile_id, organization_id, ownership_percent"),
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
      : { data: [] }
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

  const totalValue = ownerships.reduce((sum, ownership) => {
    const value = Number(ownership.properties?.current_value || 0);
    return sum + value * (Number(ownership.ownership_percent || 0) / 100);
  }, 0);

  const rows = ownerships.map((ownership) => {
    const property = ownership.properties || {};
    const percent = Number(ownership.ownership_percent || 0);
    const proportionalValue = Number(property.current_value || 0) * (percent / 100);

    return {
      id: ownership.id,
      property: (
        <div className={styles.propertyName}>
          <strong>{property.name}</strong>
          <span>{property.address}</span>
        </div>
      ),
      district: property.districts?.name || "Sin delegacion",
      appreciation: property.district_id ? (
        <Badge tone={getAppreciationTrendTone(districtMetricsById.get(property.district_id)?.trend)}>
          {formatAppreciationRate(districtMetricsById.get(property.district_id)?.currentRate)}
        </Badge>
      ) : (
        "Sin indice"
      ),
      type: <Badge tone="info">{formatPropertyType(property.type)}</Badge>,
      percent: `${percent.toLocaleString("es-MX", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}%`,
      value: formatMoney(proportionalValue)
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

  const valueExplanationRows = ownerships.map((ownership) => {
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
      previousValue: proportionalPrevious !== null ? formatMoney(proportionalPrevious) : "Sin valor anterior",
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
    { label: "Valor proporcional", value: formatMoney(totalValue) },
    {
      label: "Delegaciones",
      value: new Set(ownerships.map((ownership) => ownership.properties?.district_id).filter(Boolean)).size
    },
    { label: "Tipo de posesion", value: "Jugador" }
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
        description="Consulta propiedades donde tienes participacion directa como jugador y el valor estimado de tu porcentaje."
        eyebrow="Perfil inmobiliario"
        title="Mis propiedades"
      />

      <section className={styles.grid}>
        <Card className={styles.card}>
          <SectionHeader
            description="Resumen privado de participacion directa. Las propiedades por organizacion se integraran en una fase posterior."
            eyebrow="Resumen"
            title="Participacion actual"
          />
          <DataList items={summaryItems} />
        </Card>

        <Card className={styles.card}>
          <SectionHeader
            description="El valor se calcula con el porcentaje que tienes sobre el valor vigente de cada propiedad."
            eyebrow="Estimado"
            title="Valor proporcional"
          />
          <div className={styles.valuePanel}>
            <Percent size={22} />
            <strong>{formatMoney(totalValue)}</strong>
            <span>Valor directo acumulado</span>
          </div>
        </Card>
      </section>

      <Card className={styles.card}>
        <SectionHeader
          description="Listado de propiedades registradas directamente a tu nombre."
          eyebrow="Registro"
          title="Propiedades directas"
        />
        {ownerships.length ? (
          <Table
            columns={[
              { key: "property", label: "Propiedad" },
              { key: "district", label: "Delegacion" },
              { key: "appreciation", label: "Plusvalia zona" },
              { key: "type", label: "Tipo" },
              { key: "percent", label: "Porcentaje" },
              { key: "value", label: "Valor proporcional" }
            ]}
            getRowKey={(row) => row.id}
            rows={rows}
          />
        ) : (
          <EmptyState
            action={
              <LinkButton href="/dashboard" icon={MapPinned} variant="secondary">
                Volver al panel
              </LinkButton>
            }
            description="Cuando el gobierno registre una propiedad a tu nombre, aparecera aqui con porcentaje y valor proporcional."
            icon={LandPlot}
            title="Aun no tienes propiedades"
          />
        )}
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          description="Zonas donde tienes propiedades directas, con tendencia calculada contra la base registrada por gobierno."
          eyebrow="Plusvalia"
          title="Mis zonas"
        />
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
            title="Sin zonas con propiedades"
          />
        )}
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          description="Cruza el historial de valoraciones de tus propiedades con el ultimo snapshot de plusvalia de su delegacion."
          eyebrow="Auditoria"
          title="Por que cambio mi valor"
        />
        {valueExplanationRows.length ? (
          <Table
            columns={[
              { key: "property", label: "Propiedad" },
              { key: "previousValue", label: "Valor anterior" },
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
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          description="Solicita al gobierno autorizacion para construir, modificar o demoler una propiedad directa."
          eyebrow="Permisos"
          title="Nueva solicitud"
        />
        <PermitRequestForm properties={propertyOptions} />
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          description="Seguimiento de solicitudes enviadas al gobierno y su decision."
          eyebrow="Permisos"
          title="Solicitudes recientes"
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
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          description="Esta vista evita mostrar informacion privada de otros propietarios. Solo aparecen tus participaciones directas."
          eyebrow="Privacidad"
          title="Alcance de esta vista"
        />
        <div className={styles.notice}>
          <Building2 size={18} />
          <p>
            Las propiedades de organizaciones donde participas se conectaran cuando avancemos el modulo de organizaciones.
          </p>
        </div>
      </Card>
    </main>
  );
}
