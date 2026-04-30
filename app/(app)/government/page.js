import { ArrowLeft, Building2, Landmark, MapPinned } from "lucide-react";
import { Badge, Card, EmptyState, LinkButton, PageHeader, SectionHeader, Table } from "../../../components/ui";
import { requireGovernmentProfile } from "../../../lib/auth";
import { createSupabaseServerClient, getSupabaseServiceClient } from "../../../lib/supabase/server";
import { DistrictForm } from "./DistrictForm";
import { PropertyForm } from "./PropertyForm";
import { ValuationForm } from "./ValuationForm";
import styles from "./page.module.css";

export const metadata = {
  title: "Gobierno - CityCraft App"
};

function formatRate(value) {
  return `${Number(value || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  })}%`;
}

function formatMoney(value) {
  return `₵${Number(value || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
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

function formatDate(value) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default async function GovernmentPage() {
  await requireGovernmentProfile("/government");
  const supabase = await createSupabaseServerClient();
  const serviceSupabase = getSupabaseServiceClient();

  const { data: districts = [] } = await supabase
    .from("districts")
    .select("id, name, slug, description, base_appreciation_rate, created_at")
    .order("name", { ascending: true });

  const { data: properties = [] } = await supabase.from("properties").select("district_id");

  const { data: propertyRows = [] } = await supabase
    .from("properties")
    .select("id, name, address, type, size_blocks, current_value, districts(name)")
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: valuations = [] } = await supabase
    .from("property_valuations")
    .select("id, value, reason, created_at, properties(id, name)")
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: profiles = [] } = await serviceSupabase
    .from("profiles")
    .select("id, gamertag")
    .order("gamertag", { ascending: true });

  const { data: organizations = [] } = await serviceSupabase
    .from("organizations")
    .select("id, name, type")
    .order("type", { ascending: true })
    .order("name", { ascending: true });

  const propertyCountByDistrict = properties.reduce((counts, property) => {
    counts[property.district_id] = (counts[property.district_id] || 0) + 1;
    return counts;
  }, {});

  const rows = districts.map((district) => ({
    id: district.id,
    name: (
      <div className={styles.districtName}>
        <strong>{district.name}</strong>
        <span>{district.slug}</span>
      </div>
    ),
    appreciation: formatRate(district.base_appreciation_rate),
    properties: (
      <Badge tone={propertyCountByDistrict[district.id] ? "info" : "neutral"}>
        {propertyCountByDistrict[district.id] || 0}
      </Badge>
    ),
    description: district.description || "Sin descripcion"
  }));

  const propertyTableRows = propertyRows.map((property) => ({
    id: property.id,
    name: (
      <div className={styles.districtName}>
        <strong>{property.name}</strong>
        <span>{property.address}</span>
      </div>
    ),
    district: property.districts?.name || "Sin delegacion",
    type: <Badge tone="info">{formatPropertyType(property.type)}</Badge>,
    size: Number(property.size_blocks).toLocaleString("es-MX"),
    value: formatMoney(property.current_value)
  }));

  const valuationRows = valuations.map((valuation) => ({
    id: valuation.id,
    property: valuation.properties?.name || "Propiedad no disponible",
    value: formatMoney(valuation.value),
    reason: valuation.reason,
    createdAt: formatDate(valuation.created_at)
  }));

  return (
    <main className={styles.page}>
      <PageHeader
        actions={
          <LinkButton href="/dashboard" icon={ArrowLeft} variant="secondary">
            Dashboard
          </LinkButton>
        }
        description="Administracion inicial de delegaciones, registro inmobiliario y datos publicos del gobierno."
        eyebrow="Gobierno"
        title="Registro territorial"
      />

      <section className={styles.grid}>
        <Card className={styles.card}>
          <SectionHeader
            eyebrow="Delegaciones"
            title="Nueva delegacion"
            description="Cada propiedad debe pertenecer a una zona para habilitar reportes y plusvalia futura."
          />
          <DistrictForm />
        </Card>

        <Card className={styles.card}>
          <SectionHeader
            eyebrow="Resumen"
            title="Cobertura territorial"
            description="Lectura rapida del estado inicial de la ciudad registrada."
          />
          <div className={styles.stats}>
            <article>
              <MapPinned size={20} />
              <strong>{districts.length}</strong>
              <span>Delegaciones</span>
            </article>
            <article>
              <Building2 size={20} />
              <strong>{properties.length}</strong>
              <span>Propiedades</span>
            </article>
          </div>
        </Card>
      </section>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Propiedades"
          title="Nueva propiedad"
          description="El registro crea propiedad, propietario inicial y valoracion inicial en una sola operacion."
        />
        <PropertyForm districts={districts} organizations={organizations} profiles={profiles} />
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Valoracion"
          title="Nueva valoracion"
          description="Cada ajuste crea un registro historico y actualiza el valor vigente de la propiedad."
        />
        <ValuationForm properties={propertyRows} />
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Directorio"
          title="Delegaciones registradas"
          description="Listado administrativo con conteo de propiedades por zona."
        />
        {districts.length ? (
          <Table
            columns={[
              { key: "name", label: "Delegacion" },
              { key: "appreciation", label: "Plusvalia base" },
              { key: "properties", label: "Propiedades" },
              { key: "description", label: "Descripcion" }
            ]}
            getRowKey={(row) => row.id}
            rows={rows}
          />
        ) : (
          <EmptyState
            description="Registra la primera delegacion para empezar a ubicar propiedades."
            icon={Landmark}
            title="Sin delegaciones"
          />
        )}
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Registro inmobiliario"
          title="Propiedades recientes"
          description="Listado administrativo de las ultimas propiedades registradas."
        />
        {propertyRows.length ? (
          <Table
            columns={[
              { key: "name", label: "Propiedad" },
              { key: "district", label: "Delegacion" },
              { key: "type", label: "Tipo" },
              { key: "size", label: "Bloques" },
              { key: "value", label: "Valor" }
            ]}
            getRowKey={(row) => row.id}
            rows={propertyTableRows}
          />
        ) : (
          <EmptyState
            description="Cuando registres propiedades, apareceran aqui con su delegacion, tipo y valor actual."
            icon={Building2}
            title="Sin propiedades registradas"
          />
        )}
      </Card>

      <Card className={styles.card}>
        <SectionHeader
          eyebrow="Historial"
          title="Valoraciones recientes"
          description="Historial auditable de cambios de valor. Los registros no se editan; se agrega una nueva valoracion."
        />
        {valuations.length ? (
          <Table
            columns={[
              { key: "property", label: "Propiedad" },
              { key: "value", label: "Valor" },
              { key: "reason", label: "Razon" },
              { key: "createdAt", label: "Fecha" }
            ]}
            getRowKey={(row) => row.id}
            rows={valuationRows}
          />
        ) : (
          <EmptyState
            description="Las propiedades nuevas ya generan una valoracion inicial; los cambios posteriores apareceran aqui."
            icon={Landmark}
            title="Sin valoraciones"
          />
        )}
      </Card>
    </main>
  );
}
