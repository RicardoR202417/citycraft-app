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
const RECENT_ACTIVITY_DAYS = 30;
const DEFAULT_MAX_CHANGE = 2.5;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function number(value) {
  return Number(value || 0);
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

function getOwnerKey(owner) {
  if (owner.owner_type === "organization") {
    return `organization:${owner.organization_id}`;
  }

  return `profile:${owner.profile_id}`;
}

function calculateConcentrationImpact(districtProperties, owners) {
  if (!owners?.length || !districtProperties.length) {
    return {
      detail: "Sin datos suficientes de propietarios para medir concentracion.",
      impact: 0
    };
  }

  const propertyById = new Map(districtProperties.map((property) => [property.id, property]));
  const ownerExposure = new Map();
  let totalExposure = 0;

  for (const owner of owners) {
    const property = propertyById.get(owner.property_id);

    if (!property || property.status !== "active") {
      continue;
    }

    const exposure = number(property.current_value) * (number(owner.ownership_percent) / 100);

    if (exposure <= 0) {
      continue;
    }

    const key = getOwnerKey(owner);
    ownerExposure.set(key, (ownerExposure.get(key) || 0) + exposure);
    totalExposure += exposure;
  }

  if (!totalExposure || !ownerExposure.size) {
    return {
      detail: "Sin exposicion economica suficiente para medir concentracion.",
      impact: 0
    };
  }

  const shares = Array.from(ownerExposure.values()).map((value) => value / totalExposure);
  const hhi = shares.reduce((total, share) => total + share * share, 0);
  const largestShare = Math.max(...shares);
  const concentrationPenalty = hhi > 0.45 || largestShare > 0.65 ? clamp((hhi - 0.35) * 1.2, 0, 0.55) : 0;
  const diversityBonus = hhi < 0.28 && shares.length >= 3 ? 0.18 : 0;

  return {
    detail: `${shares.length.toLocaleString("es-MX")} actores con exposicion registrada; mayor concentracion ${(largestShare * 100).toLocaleString("es-MX", {
      maximumFractionDigits: 1
    })}%.`,
    impact: diversityBonus - concentrationPenalty
  };
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

export function calculateDistrictAppreciation(district, properties = [], options = {}) {
  const baseRate = number(district?.base_appreciation_rate);
  const previousIndex = Number.isFinite(Number(options.previousIndex)) ? Number(options.previousIndex) : baseRate;
  const maxChange = Number.isFinite(Number(options.maxChange)) ? Number(options.maxChange) : DEFAULT_MAX_CHANGE;
  const owners = Array.isArray(options.owners) ? options.owners : [];
  const districtProperties = properties.filter((property) => property.district_id === district?.id);
  const activeProperties = districtProperties.filter((property) => property.status === "active");
  const plannedProperties = districtProperties.filter((property) => property.status === "planned");
  const developedProperties = activeProperties.filter((property) => property.type !== "land");
  const landProperties = activeProperties.filter((property) => property.type === "land");
  const civicProperties = activeProperties.filter((property) => CIVIC_TYPES.has(property.type));
  const demolishedProperties = districtProperties.filter((property) => property.status === "demolished");
  const archivedProperties = districtProperties.filter((property) => property.status === "archived");
  const inactiveProperties = [...demolishedProperties, ...archivedProperties];
  const recentProperties = districtProperties.filter(
    (property) =>
      daysSince(property.updated_at || property.created_at) <= RECENT_ACTIVITY_DAYS ||
      daysSince(property.created_at) <= RECENT_ACTIVITY_DAYS
  );
  const totalValue = activeProperties.reduce((total, property) => total + number(property.current_value), 0);
  const totalBlocks = activeProperties.reduce((total, property) => total + number(property.size_blocks), 0);
  const valuePerBlock = totalBlocks > 0 ? totalValue / totalBlocks : 0;

  const constructionImpact = clamp(developedProperties.length * 0.045 + plannedProperties.length * 0.025, 0, 1.35);
  const civicImpact = clamp(
    civicProperties.reduce((total, property) => total + Math.max(TYPE_IMPACT[property.type] || 0, 0), 0),
    0,
    0.95
  );
  const valueImpact = clamp(Math.log10(Math.max(valuePerBlock, 1)) * 0.06, 0, 0.45);
  const activityImpact = clamp(recentProperties.length * 0.05, 0, 0.65);
  const concentration = calculateConcentrationImpact(districtProperties, owners);
  const landImpact = -clamp(landProperties.length * Math.abs(TYPE_IMPACT.land), 0, 0.45);
  const demolitionImpact = -clamp(demolishedProperties.length * 0.18 + archivedProperties.length * 0.08, 0, 0.85);
  const adjustment =
    constructionImpact +
    civicImpact +
    valueImpact +
    activityImpact +
    concentration.impact +
    landImpact +
    demolitionImpact;
  const rawIndex = clamp(baseRate + adjustment, -100, 100);
  const limitedIndex = clamp(rawIndex, previousIndex - maxChange, previousIndex + maxChange);
  const currentRate = clamp(limitedIndex, -100, 100);
  const delta = currentRate - previousIndex;
  const trend = delta > 0.05 ? "up" : delta < -0.05 ? "down" : "stable";

  return {
    adjustment,
    baseRate,
    currentRate,
    delta,
    limitApplied: Math.abs(rawIndex - currentRate) > 0.001,
    maxChange,
    previousIndex,
    rawIndex,
    factors: [
      {
        id: "base",
        label: "Base de gobierno",
        detail: "Indice inicial definido para la delegacion.",
        value: baseRate
      },
      {
        id: "construction",
        label: "Construcciones y proyectos",
        detail: `${developedProperties.length.toLocaleString("es-MX")} construcciones activas y ${plannedProperties.length.toLocaleString("es-MX")} planeadas.`,
        value: constructionImpact
      },
      {
        id: "civic",
        label: "Servicios y obra civica",
        detail: `${civicProperties.length.toLocaleString("es-MX")} propiedades publicas, servicio, infraestructura o cultura.`,
        value: civicImpact
      },
      {
        id: "activity",
        label: "Actividad reciente",
        detail: `${recentProperties.length.toLocaleString("es-MX")} propiedades creadas o actualizadas en los ultimos ${RECENT_ACTIVITY_DAYS} dias.`,
        value: activityImpact
      },
      {
        id: "concentration",
        label: "Concentracion economica",
        detail: concentration.detail,
        value: concentration.impact
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
        id: "demolition",
        label: "Demoliciones e inactividad",
        detail: `${demolishedProperties.length.toLocaleString("es-MX")} demolidas y ${archivedProperties.length.toLocaleString("es-MX")} archivadas.`,
        value: demolitionImpact
      },
      {
        id: "limit",
        label: "Limite por recalculo",
        detail: `Cambio maximo permitido por snapshot: ${formatAppreciationRate(maxChange)}.`,
        value: currentRate - rawIndex
      }
    ],
    propertyCount: districtProperties.length,
    totalBlocks,
    totalValue,
    trend,
    valuePerBlock
  };
}
