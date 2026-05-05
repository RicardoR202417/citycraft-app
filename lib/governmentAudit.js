export const GOVERNMENT_AUDIT_ACTIONS = {
  "attendance.recorded": {
    label: "Asistencia registrada",
    tone: "info",
    area: "Asistencia"
  },
  "daily_payout.created": {
    label: "Pago diario generado",
    tone: "success",
    area: "Economia"
  },
  "government.fine_applied": {
    label: "Multa aplicada",
    tone: "warning",
    area: "Multas"
  },
  "government.district_appreciation_recorded": {
    label: "Plusvalia registrada",
    tone: "success",
    area: "Plusvalia"
  },
  "government.permit_request_approved": {
    label: "Permiso aprobado",
    tone: "success",
    area: "Permisos"
  },
  "government.permit_request_rejected": {
    label: "Permiso rechazado",
    tone: "danger",
    area: "Permisos"
  },
  "government.property_seized": {
    label: "Propiedad decomisada",
    tone: "danger",
    area: "Decomisos"
  },
  "government.unowned_land_created": {
    label: "Tierra gubernamental registrada",
    tone: "info",
    area: "Tierras"
  },
  "government.unowned_land_disposition_updated": {
    label: "Disponibilidad de tierra actualizada",
    tone: "warning",
    area: "Tierras"
  },
  "organization_daily_payout.created": {
    label: "Pago proporcional a organizacion",
    tone: "success",
    area: "Economia"
  },
  "property.created": {
    label: "Propiedad registrada",
    tone: "info",
    area: "Propiedades"
  },
  "property.unit_created": {
    label: "Unidad privativa registrada",
    tone: "info",
    area: "Propiedades"
  },
  "property.valuation_recorded": {
    label: "Valoracion registrada",
    tone: "success",
    area: "Valoraciones"
  }
};

export const GOVERNMENT_AUDIT_COVERAGE = [
  {
    id: "fines",
    area: "Multas",
    actions: ["government.fine_applied"],
    status: "active",
    evidence: "RPC apply_government_fine"
  },
  {
    id: "seizures",
    area: "Decomisos",
    actions: ["government.property_seized"],
    status: "active",
    evidence: "RPC seize_property_for_government"
  },
  {
    id: "permits",
    area: "Permisos",
    actions: ["government.permit_request_approved", "government.permit_request_rejected"],
    status: "active",
    evidence: "RPC decide_property_permit_request"
  },
  {
    id: "land-market",
    area: "Ventas y subastas de tierras",
    actions: ["government.unowned_land_disposition_updated"],
    status: "partial",
    evidence: "Audita cambios a for_sale y for_auction; cierre de mercado queda para el modulo de mercado"
  }
];

const ENTITY_LABELS = {
  attendance_record: "Asistencia",
  daily_payout: "Pago diario",
  fine: "Multa",
  government_property_seizure: "Decomiso",
  organization_daily_payout: "Pago de organizacion",
  permit_request: "Solicitud de permiso",
  property: "Propiedad"
};

export function isGovernmentAuditAction(action) {
  return Boolean(GOVERNMENT_AUDIT_ACTIONS[action]);
}

export function formatGovernmentAuditAction(action) {
  return GOVERNMENT_AUDIT_ACTIONS[action]?.label || action || "Accion no disponible";
}

export function getGovernmentAuditTone(action) {
  return GOVERNMENT_AUDIT_ACTIONS[action]?.tone || "neutral";
}

export function formatGovernmentAuditArea(action) {
  return GOVERNMENT_AUDIT_ACTIONS[action]?.area || "General";
}

export function formatAuditEntityType(entityType) {
  return ENTITY_LABELS[entityType] || entityType || "Entidad no disponible";
}

export function getGovernmentAuditReason(event) {
  const metadata = event?.metadata || {};
  return (
    metadata.reason ||
    metadata.government_comment ||
    metadata.notes ||
    metadata.description ||
    metadata.valuation_reason ||
    metadata.new_government_disposition ||
    metadata.status ||
    "Sin razon registrada"
  );
}
