import { ArrowLeft, Building2, LandPlot, MapPinned, Percent } from "lucide-react";
import { Badge, Card, DataList, EmptyState, LinkButton, PageHeader, SectionHeader, Table } from "../../../components/ui";
import { requireProfile } from "../../../lib/auth";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import styles from "./page.module.css";

export const metadata = {
  title: "Mis propiedades - CityCraft App"
};

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

export default async function PropertiesPage() {
  const profile = await requireProfile("/properties");
  const supabase = await createSupabaseServerClient();

  const { data: ownerships = [] } = await supabase
    .from("property_owners")
    .select(
      `
        id,
        ownership_percent,
        properties (
          id,
          name,
          address,
          type,
          size_blocks,
          current_value,
          districts (name)
        )
      `
    )
    .eq("profile_id", profile.id)
    .order("acquired_at", { ascending: false });

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
      type: <Badge tone="info">{formatPropertyType(property.type)}</Badge>,
      percent: `${percent.toLocaleString("es-MX", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}%`,
      value: formatMoney(proportionalValue)
    };
  });

  const summaryItems = [
    { label: "Propiedades directas", value: ownerships.length },
    { label: "Valor proporcional", value: formatMoney(totalValue) },
    { label: "Tipo de posesion", value: "Jugador" }
  ];

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
