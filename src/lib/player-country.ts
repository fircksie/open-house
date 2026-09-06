// Country names come from the feed; never infer nationality from a player's name.
const aliases: Record<string, string> = {
  USA: 'US', GBR: 'GB', UK: 'GB', 'GREAT BRITAIN': 'GB', 'UNITED STATES OF AMERICA': 'US',
  RSA: 'ZA', ZAF: 'ZA', AUS: 'AU', AUT: 'AT', ARG: 'AR', BEL: 'BE', BRA: 'BR',
  CAN: 'CA', CHN: 'CN', CRO: 'HR', HRV: 'HR', CZE: 'CZ', 'CZECH REPUBLIC': 'CZ',
  DEN: 'DK', DNK: 'DK', ESP: 'ES', FRA: 'FR', GER: 'DE', DEU: 'DE', GRE: 'GR', GRC: 'GR',
  ITA: 'IT', JPN: 'JP', KOR: 'KR', KAZ: 'KZ', LAT: 'LV', LVA: 'LV', LTU: 'LT',
  NED: 'NL', NLD: 'NL', NOR: 'NO', NZL: 'NZ', POL: 'PL', POR: 'PT', PRT: 'PT',
  ROU: 'RO', RUS: 'RU', SRB: 'RS', SUI: 'CH', CHE: 'CH', SVK: 'SK', SLO: 'SI', SVN: 'SI',
  SWE: 'SE', UKR: 'UA', BLR: 'BY', HUN: 'HU', FIN: 'FI', IRL: 'IE', ISR: 'IL',
  IND: 'IN', MEX: 'MX', CHI: 'CL', CHL: 'CL', COL: 'CO', ECU: 'EC', PER: 'PE',
  TPE: 'TW', 'CHINESE TAIPEI': 'TW', HKG: 'HK', GEO: 'GE', BUL: 'BG', BGR: 'BG',
  TUR: 'TR', TUN: 'TN', EGY: 'EG', MAR: 'MA', LUX: 'LU', BIH: 'BA', MNE: 'ME',
};
const names = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'code' });
const regions = new Map<string, string>();
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b);
  if (Intl.getCanonicalLocales('und-' + code)[0] !== 'und-' + code) continue;
  const name = names.of(code);
  if (name && name !== code && !['ZZ', 'EU', 'UN', 'XA', 'XB'].includes(code)) {
    regions.set(code, code);
    regions.set(name.toUpperCase(), code);
  }
}
export function playerCountry(country?: string) {
  const value = country?.trim().toUpperCase();
  if (!value) return null;
  const code = aliases[value] ?? regions.get(value);
  if (!code) return null;
  return { name: names.of(code) ?? country!, flag: [...code].map(c => String.fromCodePoint(127397 + c.charCodeAt(0))).join('') };
}
