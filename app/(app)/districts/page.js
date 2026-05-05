import { ArrowLeft, Building2, Landmark, MapPinned, TrendingDown, TrendingUp } from "lucide-react";
import { Badge, Card, DataList, EmptyState, LinkButton, PageHeader, SectionHeader, Table } from "../../../components/ui";
import {
  calculateDistrictAppreciation,
  formatAppreciationRate,
  formatAppreciationTrend,
  getAppreciationTrendTone
} from "../../../lib/appreciation";
import { requireProfile } from "../../../lib/auth";
import { formatMoney } from "../../../lib/economy";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import styles from "./page.module.css";

export const metadata = {
  title: "Delegaciones - CityCraft App"
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getTrendIcon(trend) {
  if (trend === "down") {
    return TrendingDown;
  }

  return TrendingUp;
}

export default async function DistrictsPage() {
  await requireProfile("/districts");
  const supabase = await createSupabaseServerClient();

  const [{ data: districtsData = [] }, { data: propertiesData = [] }] = await Promise.all([
    supabase
      .from("districts")
      .select("id, name, slug, description, base_appreciation_rate")
      .order("name", { ascending: true }),
    supabase
      .from("properties")
      .select("id, district_id, type, status, size_blocks, current_value")
  ]);

  const districts = asArray(districtsData);
  const properties = asArray(propertiesData);
  const metricsByDistrict = new Map(
    districts.map((district) => [district.id, calculateDistrictAppreciation(district, properties)])
  );
  const cityValue = properties.reduce((total, property) => total + Number(property.current_value || 0), 0);
  const averageIndex = districts.length
    ? districts.reduce((total, district) => total + metricsByDistrict.get(district.id).currentRate, 0) / districts.length
    : 0;
  const strongestDistrict = districts.reduce((candidate, district) => {
    if (!candidate) {
      return district;
    }

    return metricsByDistrict.get(district.id).currentRate > metricsByDistrict.get(candidate.id).currentRate
      ? district
      : candidate;
  }, null);

  const summaryItems = [
    { label: "Delegaciones", value: districts.length.toLocaleString("es-MX") },
    { label: "Indice promedio", value: formatAppreciationRate(averageIndex) },
    { label: "Valor registrado", value: formatMoney(cityValue) },
    { label: "Mayor plusvalia", value: strongestDistrict?.name || "Sin datos" }
  ];

  const rows = districts.map((district) => {
    const metrics = metricsByDistrict.get(district.id);

    return {
      id: district.id,
      district: (
        <div className={styles.nameCell}>
          <strong>{district.name}</strong>
          <span>{district.slug}</span>
        </div>
      ),
      currentIndex: formatAppreciationRate(metrics.currentRate),
      trend: <Badge tone={getAppreciationTrendTone(metrics.trend)}>{formatAppreciationTrend(metrics.trend)}</Badge>,
      delta: formatAppreciationRate(metrics.delta),
      properties: metrics.propertyCount.toLocaleString("es-MX"),
      value: formatMoney(metrics.totalValue),
      mainFactor: metrics.factors
        .filter((factor) => factor.id !== "base")
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0]?.label || "Base de gobierno"
    };
  });

  return (
    <main className={styles.page}>
      <PageHeader
        actions={
          <LinkButton href="/dashboard" icon={ArrowLeft} variant="secondary">
            Dashboard
          </LinkButton>
        }
        description="Consulta el indice actual de plusvalia por delegacion y los factores que explican su movimiento."
        eyebrow="Plusvalia territorial"
        title="Delegaciones"
      />

      <section className={styles.grid}>
        <Card className={styles.card}>
          <SectionHeader
            description="Lectura compacta de las delegaciones registradas y el valor urbano actual."
            eyebrow="Resumen"
            title="Estado de la ciudad"
          />
          <DataList items={summaryItems} />
        </Card>

        <Card className={styles.card}>
          <SectionHeader
            description="El indice actual combina base de gobierno, actividad registrada y composicion de propiedades."
            eyebrow="Indice actual"
            title="Plusvalia promedio"
          />
          <div className={styles.indexPanel}>
            <Landmark size={22} />
            <strong>{formatAppreciationRate(averageIndex)}</strong>
            <span>Promedio de delegaciones</span>
          </div>
        </Card>
      </section>

      <Card className={styles.card}>
        <SectionHeader
          description="Cada fila muestra indice actual, tendencia contra la base y el factor con mayor peso."
          eyebrow="Delegaciones"
          title="Indice por zona"
        />
        {rows.length ? (
          <Table
            columns={[
              { key: "district", label: "Delegacion" },
              { key: "currentIndex", label: "Indice actual" },
              { key: "trend", label: "Tendencia" },
              { key: "delta", label: "Cambio" },
              { key: "properties", label: "Propiedades" },
              { key: "value", label: "Valor" },
              { key: "mainFactor", label: "Factor principal" }
            ]}
            getRowKey={(row) => row.id}
            rows={rows}
          />
        ) : (
          <EmptyState
            description="Cuando el gobierno registre delegaciones, aqui aparecera su indice de plusvalia."
            icon={MapPinned}
            title="Sin delegaciones"
          />
        )}
      </Card>

      <section className={styles.districtGrid}>
        {districts.map((district) => {
          const metrics = metricsByDistrict.get(district.id);
          const TrendIcon = getTrendIcon(metrics.trend);

          return (
            <Card className={styles.districtCard} key={district.id}>
              <div className={styles.cardHeader}>
                <div>
                  <span>{district.slug}</span>
                  <h2>{district.name}</h2>
                </div>
                <Badge tone={getAppreciationTrendTone(metrics.trend)}>{formatAppreciationTrend(metrics.trend)}</Badge>
              </div>

              <div className={styles.metricLine}>
                <TrendIcon size={20} />
                <strong>{formatAppreciationRate(metrics.currentRate)}</strong>
                <span>Actual</span>
              </div>

              <p>{district.description || "Delegacion registrada sin descripcion publica."}</p>

              <div className={styles.factorList}>
                {metrics.factors.map((factor) => (
                  <article key={factor.id}>
                    <div>
                      <strong>{factor.label}</strong>
                      <span>{factor.detail}</span>
                    </div>
                    <Badge tone={factor.value >= 0 ? "success" : "danger"}>
                      {formatAppreciationRate(factor.value)}
                    </Badge>
                  </article>
                ))}
              </div>

              <div className={styles.note}>
                <Building2 size={18} />
                <span>Ultimo cambio: recalculado con el registro inmobiliario actual.</span>
              </div>
            </Card>
          );
        })}
      </section>
    </main>
  );
}
