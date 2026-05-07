const TYPE_VALUATION_RULES = {
  commercial: { constructionBlockValue: 145, landBlockValue: 42, label: "Local" },
  corporate: { constructionBlockValue: 170, landBlockValue: 48, label: "Corporativo" },
  cultural: { constructionBlockValue: 130, landBlockValue: 34, label: "Cultural" },
  entertainment: { constructionBlockValue: 150, landBlockValue: 40, label: "Entretenimiento" },
  infrastructure: { constructionBlockValue: 90, landBlockValue: 26, label: "Infraestructura" },
  land: { constructionBlockValue: 0, landBlockValue: 28, label: "Terreno" },
  public: { constructionBlockValue: 110, landBlockValue: 24, label: "Publica" },
  residential: { constructionBlockValue: 115, landBlockValue: 36, label: "Habitacional" },
  service: { constructionBlockValue: 125, landBlockValue: 30, label: "Servicio" }
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getPropertyValuationRule(type) {
  return TYPE_VALUATION_RULES[type] || TYPE_VALUATION_RULES.land;
}

export function calculateSuggestedPropertyValue({
  buildingAreaBlocks = 0,
  districtAppreciationRate = 0,
  landAreaBlocks = 0,
  type = "land"
} = {}) {
  const rule = getPropertyValuationRule(type);
  const landArea = Math.max(number(landAreaBlocks), 0);
  const buildingArea = Math.max(number(buildingAreaBlocks), 0);
  const appreciationRate = clamp(number(districtAppreciationRate), -35, 60);
  const zoneMultiplier = 1 + appreciationRate / 100;
  const landValue = landArea * rule.landBlockValue;
  const constructionValue = buildingArea * rule.constructionBlockValue;
  const subtotal = landValue + constructionValue;
  const zoneAdjustment = subtotal * (zoneMultiplier - 1);
  const suggestedValue = Math.max(subtotal + zoneAdjustment, 0);

  return {
    appreciationRate,
    buildingAreaBlocks: buildingArea,
    constructionBlockValue: rule.constructionBlockValue,
    constructionValue: money(constructionValue),
    landAreaBlocks: landArea,
    landBlockValue: rule.landBlockValue,
    landValue: money(landValue),
    propertyTypeLabel: rule.label,
    subtotal: money(subtotal),
    suggestedValue: money(suggestedValue),
    zoneAdjustment: money(zoneAdjustment),
    zoneMultiplier: money(zoneMultiplier)
  };
}
