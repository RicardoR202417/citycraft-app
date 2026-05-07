export const MEXICO_CITY_TIME_ZONE = "America/Mexico_City";

const DEFAULT_DATE_TIME_OPTIONS = {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: MEXICO_CITY_TIME_ZONE
};

export function formatMexicoDateTime(value, fallback = "Pendiente", options = {}) {
  if (!value) {
    return fallback;
  }

  return new Intl.DateTimeFormat("es-MX", {
    ...DEFAULT_DATE_TIME_OPTIONS,
    ...options,
    timeZone: options.timeZone || MEXICO_CITY_TIME_ZONE
  }).format(new Date(value));
}

export function formatMexicoDate(value, fallback = "Pendiente", options = {}) {
  if (!value) {
    return fallback;
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    ...options,
    timeZone: options.timeZone || MEXICO_CITY_TIME_ZONE
  }).format(new Date(value));
}

export function formatTimeLeft(value, now = Date.now()) {
  if (!value) {
    return "Sin cierre";
  }

  const diffMs = new Date(value).getTime() - now;

  if (diffMs <= 0) {
    return "Finalizada";
  }

  const totalMinutes = Math.ceil(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}
