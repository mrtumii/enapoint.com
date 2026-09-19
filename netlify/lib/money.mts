/** All money is handled in kobo (1 naira = 100 kobo) and all energy in milli-kWh. */

export const SERVICE_CHARGE_KOBO = 5000; // flat N50 on a top-up
export const DEFAULT_TARIFF_KOBO_PER_KWH = 28500; // band C, N285/kWh

export function nairaToKobo(naira: number) {
  return Math.round(naira * 100);
}

export function formatNaira(kobo: number | null | undefined) {
  if (kobo === null || kobo === undefined) return "—";
  const naira = kobo / 100;
  return `₦${naira.toLocaleString("en-NG", { maximumFractionDigits: naira % 1 ? 2 : 0 })}`;
}

/** Units a payment buys, in milli-kWh, after the flat service charge. */
export function unitsForAmount(amountKobo: number, tariffKoboPerKwh = DEFAULT_TARIFF_KOBO_PER_KWH) {
  const spendable = Math.max(0, amountKobo - SERVICE_CHARGE_KOBO);
  return Math.round((spendable / tariffKoboPerKwh) * 1000);
}

export function formatKwh(milli: number) {
  return `${(milli / 1000).toFixed(1)} kWh`;
}
