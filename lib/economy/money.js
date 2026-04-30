export const CITYCRAFT_CURRENCY_SYMBOL = "CC$";

export function formatMoney(value, currencySymbol = CITYCRAFT_CURRENCY_SYMBOL) {
  const amount = Number(value || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return `${currencySymbol || CITYCRAFT_CURRENCY_SYMBOL}${amount}`;
}

export function getWalletCurrency(wallet) {
  return wallet?.currency_symbol || CITYCRAFT_CURRENCY_SYMBOL;
}

export function formatWalletBalance(wallet) {
  return formatMoney(wallet?.balance || 0, getWalletCurrency(wallet));
}
