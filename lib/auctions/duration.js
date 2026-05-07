export const AUCTION_DURATION_LIMITS = {
  maxMinutes: 259200,
  minMinutes: 5
};

export const AUCTION_DURATION_UNITS = {
  days: {
    label: "dias",
    minutes: 1440
  },
  hours: {
    label: "horas",
    minutes: 60
  },
  minutes: {
    label: "minutos",
    minutes: 1
  },
  months: {
    label: "meses",
    minutes: 43200
  },
  weeks: {
    label: "semanas",
    minutes: 10080
  }
};

export function calculateAuctionDurationMinutes(amount, unit) {
  const numericAmount = Number(amount);
  const durationUnit = AUCTION_DURATION_UNITS[unit];

  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !durationUnit) {
    return null;
  }

  return Math.round(numericAmount * durationUnit.minutes);
}

export function isAuctionDurationAllowed(durationMinutes) {
  return (
    Number.isInteger(durationMinutes) &&
    durationMinutes >= AUCTION_DURATION_LIMITS.minMinutes &&
    durationMinutes <= AUCTION_DURATION_LIMITS.maxMinutes
  );
}

export function getAuctionDurationLimitLabel() {
  return "minimo 5 minutos y maximo 6 meses";
}
