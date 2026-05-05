const TYPE_IMPACT = {
  commercial: 0.08,
  corporate: 0.1,
  cultural: 0.12,
  entertainment: 0.07,
  infrastructure: 0.18,
  land: -0.03,
  public: 0.14,
  residential: 0.04,
  service: 0.16
};

const CIVIC_TYPES = new Set(["cultural", "infrastructure", "public", "service"]);

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function number(value) {
  return Number(value || 0);
}

export function formatAppreciationRate(value) {
  const rate = number(value);
  const sign = rate > 0 ? "+" : "";

  return `${sign}${rate.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}%`;
}

export function formatAppreciationTrend(trend) {
  const labels = {
    down: "A la baja",
    stable: "Estable",
    up: "Al alza"
  };

  return labels[trend] || "Estable";
}

export function getAppreciationTrendTone(trend) {
  const tones = {
    down: "danger",
    stable: "neutral",
    up: "success"
  };

  return tones[trend] || "neutral";
}

export function calculateDistrictAppreciation(district, properties = []) {
  const baseRate = number(district?.base_appreciation_rate);
  const districtProperties = properties.filter((property) => property.district_id === district?.id);
  const activeProperties = districtProperties.filter((property) => property.status === "active");
  const developedProperties = activeProperties.filter((property) => property.type !== "land");
  const landProperties = activeProperties.filter((property) => property.type === "land");
  const civicProperties = activeProperties.filter((property) => CIVIC_TYPES.has(property.type));
  const inactiveProperties = districtProperties.filter((property) => ["archived", "demolished"].includes(property.status));
  const totalValue = activeProperties.reduce((total, property) => total + number(property.current_value), 0);
  const totalBlocks = activeProperties.reduce((total, property) => total + number(property.size_blocks), 0);
  const valuePerBlock = totalBlocks > 0 ? totalValue / totalBlocks : 0;

  const developmentImpact = clamp(developedProperties.length * 0.04, 0, 1.2);
  const civicImpact = clamp(
    civicProperties.reduce((total, property) => total + Math.max(TYPE_IMPACT[property.type] || 0, 0), 0),
    0,
    0.85
  );
  const valueImpact = clamp(Math.log10(Math.max(valuePerBlock, 1)) * 0.06, 0, 0.45);
  const landImpact = -clamp(landProperties.length * Math.abs(TYPE_IMPACT.land), 0, 0.45);
  const inactiveImpact = -clamp(inactiveProperties.length * 0.1, 0, 0.65);
  const adjustment = developmentImpact + civicImpact + valueImpact + landImpact + inactiveImpact;
  const currentRate = clamp(baseRate + adjustment, -100, 100);
  const delta = currentRate - baseRate;
  const trend = delta > 0.05 ? "up" : delta < -0.05 ? "down" : "stable";

  return {
    adjustment,
    baseRate,
    currentRate,
    delta,
    factors: [
      {
        id: "base",
        label: "Base de gobierno",
        detail: "Indice inicial definido para la delegacion.",
        value: baseRate
      },
      {
        id: "development",
        label: "Desarrollo activo",
        detail: `${developedProperties.length.toLocaleString("es-MX")} propiedades activas que no son terreno.`,
        value: developmentImpact
      },
      {
        id: "civic",
        label: "Servicios y obra civica",
        detail: `${civicProperties.length.toLocaleString("es-MX")} propiedades publicas, servicio, infraestructura o cultura.`,
        value: civicImpact
      },
      {
        id: "density-value",
        label: "Valor por bloque",
        detail: valuePerBlock ? `${Math.round(valuePerBlock).toLocaleString("es-MX")} por bloque registrado.` : "Sin valor por bloque suficiente.",
        value: valueImpact
      },
      {
        id: "available-land",
        label: "Terreno sin desarrollar",
        detail: `${landProperties.length.toLocaleString("es-MX")} terrenos activos aun sin construccion.`,
        value: landImpact
      },
      {
        id: "inactive",
        label: "Propiedades inactivas",
        detail: `${inactiveProperties.length.toLocaleString("es-MX")} propiedades archivadas o demolidas.`,
        value: inactiveImpact
      }
    ],
    propertyCount: districtProperties.length,
    totalBlocks,
    totalValue,
    trend,
    valuePerBlock
  };
}
