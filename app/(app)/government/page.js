import { ArrowLeft, Building2, Landmark, MapPinned } from "lucide-react";
import { Badge, Card, EmptyState, LinkButton, PageHeader, SectionHeader, Table } from "../../../components/ui";
import { requireGovernmentProfile } from "../../../lib/auth";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { DistrictForm } from "./DistrictForm";
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

export default async function GovernmentPage() {
  await requireGovernmentProfile("/government");
  const supabase = await createSupabaseServerClient();

  const { data: districts = [] } = await supabase
    .from("districts")
    .select("id, name, slug, description, base_appreciation_rate, created_at")
    .order("name", { ascending: true });

  const { data: properties = [] } = await supabase.from("properties").select("district_id");

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
    </main>
  );
}
