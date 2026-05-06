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
import { createSupabaseServerClient, getSupabaseServiceClient } from "../../../lib/supabase/server";
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

function daysSince(value) {
  if (!value) {
    return Infinity;
  }

  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return Infinity;
  }

  return (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
}

function formatDate(value) {
  if (!value) {
    return "Sin historial";
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

export default async function DistrictsPage() {
  await requireProfile("/districts");
  const supabase = await createSupabaseServerClient();
  const serviceSupabase = getSupabaseServiceClient();

  const [
    { data: districtsData = [] },
    { data: propertiesData = [] },
    { data: propertyOwnersData = [] },
    { data: appreciationHistoryData = [] }
  ] = await Promise.all([
    supabase
      .from("districts")
      .select("id, name, slug, description, base_appreciation_rate")
      .order("name", { ascending: true }),
    supabase
      .from("properties")
      .select("id, district_id, type, status, size_blocks, current_value, created_at, updated_at"),
    serviceSupabase
      .from("property_owners")
      .select("property_id, owner_type, profile_id, organization_id, ownership_percent"),
    serviceSupabase
      .from("district_appreciation_history")
      .select("district_id, previous_index, new_index, change_amount, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(200)
  ]);

  const districts = asArray(districtsData);
  const properties = asArray(propertiesData);
  const propertyOwners = asArray(propertyOwnersData);
  const latestAppreciationByDistrict = new Map();

  for (const record of asArray(appreciationHistoryData)) {
    if (!latestAppreciationByDistrict.has(record.district_id)) {
      latestAppreciationByDistrict.set(record.district_id, record);
    }
  }

  const metricsByDistrict = new Map(
    districts.map((district) => [
      district.id,
      calculateDistrictAppreciation(district, properties, {
        owners: propertyOwners,
        previousIndex: latestAppreciationByDistrict.get(district.id)?.new_index
      })
    ])
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

  const propertiesByDistrict = new Map();
  const historyByDistrict = new Map();

  for (const property of properties) {
    propertiesByDistrict.set(property.district_id, [
      ...(propertiesByDistrict.get(property.district_id) || []),
      property
    ]);
  }

  for (const record of asArray(appreciationHistoryData)) {
    historyByDistrict.set(record.district_id, [
      ...(historyByDistrict.get(record.district_id) || []),
      record
    ]);
  }

  const reportRows = districts.map((district) => {
    const metrics = metricsByDistrict.get(district.id);
    const districtProperties = propertiesByDistrict.get(district.id) || [];
    const typeCounts = districtProperties.reduce((counts, property) => {
      counts[property.type] = (counts[property.type] || 0) + 1;
      return counts;
    }, {});
    const topTypes = Object.entries(typeCounts)
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, 4);
    const recentActivity = districtProperties.filter(
      (property) => daysSince(property.updated_at || property.created_at) <= 30 || daysSince(property.created_at) <= 30
    ).length;
    const history = historyByDistrict.get(district.id) || [];
    const latestHistory = history[0];

    return {
      id: district.id,
      district: (
        <div className={styles.nameCell}>
          <strong>{district.name}</strong>
          <span>{district.slug}</span>
        </div>
      ),
      typeBreakdown: topTypes.length ? (
        <div className={styles.typeBreakdown}>
          {topTypes.map(([type, count]) => (
            <span key={type}>
              {formatPropertyType(type)}: {count.toLocaleString("es-MX")}
            </span>
          ))}
        </div>
      ) : (
        "Sin propiedades"
      ),
      accumulatedValue: formatMoney(metrics.totalValue),
      appreciation: (
        <div className={styles.nameCell}>
          <strong>{formatAppreciationRate(metrics.currentRate)}</strong>
          <span>{formatAppreciationTrend(metrics.trend)}</span>
        </div>
      ),
      history: latestHistory ? (
        <div className={styles.nameCell}>
          <strong>{formatAppreciationRate(latestHistory.change_amount)}</strong>
          <span>{formatDate(latestHistory.created_at)}</span>
        </div>
      ) : (
        "Sin snapshot"
      ),
      activity: (
        <Badge tone={recentActivity ? "success" : "neutral"}>
          {recentActivity.toLocaleString("es-MX")} recientes
        </Badge>
      )
    };
  });

  const activityInsights = districts
    .map((district) => {
      const districtProperties = propertiesByDistrict.get(district.id) || [];
      const recentActivity = districtProperties.filter(
        (property) => daysSince(property.updated_at || property.created_at) <= 30 || daysSince(property.created_at) <= 30
      ).length;
      const metrics = metricsByDistrict.get(district.id);

      return {
        id: district.id,
        name: district.name,
        recentActivity,
        totalValue: metrics.totalValue,
        currentRate: metrics.currentRate,
        propertyCount: metrics.propertyCount
      };
    })
    .sort((a, b) => b.recentActivity - a.recentActivity || b.totalValue - a.totalValue)
    .slice(0, 3);

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

      <Card className={styles.card}>
        <SectionHeader
          description="Indicadores consolidados por delegacion para comparar tipos de propiedades, valor, plusvalia e historial."
          eyebrow="Reportes"
          title="Reporte por delegacion"
        />
        {reportRows.length ? (
          <Table
            columns={[
              { key: "district", label: "Delegacion" },
              { key: "typeBreakdown", label: "Propiedades por tipo" },
              { key: "accumulatedValue", label: "Valor acumulado" },
              { key: "appreciation", label: "Plusvalia actual" },
              { key: "history", label: "Historial resumido" },
              { key: "activity", label: "Actividad" }
            ]}
            getRowKey={(row) => row.id}
            rows={reportRows}
          />
        ) : (
          <EmptyState
            description="Cuando existan delegaciones registradas, aqui aparecera el reporte territorial."
            icon={MapPinned}
            title="Sin reportes"
          />
        )}
      </Card>

      <section className={styles.reportGrid}>
        {activityInsights.map((district, index) => (
          <Card className={styles.insightCard} key={district.id}>
            <span>Zona activa #{index + 1}</span>
            <h2>{district.name}</h2>
            <div className={styles.insightMetric}>
              <TrendingUp size={20} />
              <strong>{district.recentActivity.toLocaleString("es-MX")}</strong>
              <span>movimientos recientes</span>
            </div>
            <div className={styles.insightDetails}>
              <span>{district.propertyCount.toLocaleString("es-MX")} propiedades</span>
              <span>{formatMoney(district.totalValue)}</span>
              <span>{formatAppreciationRate(district.currentRate)} plusvalia</span>
            </div>
          </Card>
        ))}
      </section>

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
