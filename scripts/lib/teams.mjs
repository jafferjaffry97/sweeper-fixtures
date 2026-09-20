// Flag emoji for national teams, keyed by our canonical three-letter id.
// Club and franchise competitions use initials instead — there is no emoji for
// a club, and crests are trademarks we deliberately don't ship.
const NATION_FLAGS = {
  // South America
  ARG: { name: 'Argentina',           flag: '🇦🇷' },
  BRA: { name: 'Brazil',              flag: '🇧🇷' },
  URU: { name: 'Uruguay',             flag: '🇺🇾' },
  COL: { name: 'Colombia',            flag: '🇨🇴' },
  ECU: { name: 'Ecuador',             flag: '🇪🇨' },
  VEN: { name: 'Venezuela',           flag: '🇻🇪' },
  PAR: { name: 'Paraguay',            flag: '🇵🇾' },
  CHI: { name: 'Chile',               flag: '🇨🇱' },
  BOL: { name: 'Bolivia',             flag: '🇧🇴' },
  PER: { name: 'Peru',                flag: '🇵🇪' },

  // Europe
  FRA: { name: 'France',              flag: '🇫🇷' },
  ESP: { name: 'Spain',               flag: '🇪🇸' },
  ENG: { name: 'England',             flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  GER: { name: 'Germany',             flag: '🇩🇪' },
  POR: { name: 'Portugal',            flag: '🇵🇹' },
  NED: { name: 'Netherlands',         flag: '🇳🇱' },
  ITA: { name: 'Italy',               flag: '🇮🇹' },
  CRO: { name: 'Croatia',             flag: '🇭🇷' },
  SRB: { name: 'Serbia',              flag: '🇷🇸' },
  HUN: { name: 'Hungary',             flag: '🇭🇺' },
  SVK: { name: 'Slovakia',            flag: '🇸🇰' },
  AUT: { name: 'Austria',             flag: '🇦🇹' },
  SUI: { name: 'Switzerland',         flag: '🇨🇭' },
  DEN: { name: 'Denmark',             flag: '🇩🇰' },
  TUR: { name: 'Turkey',              flag: '🇹🇷' },
  BEL: { name: 'Belgium',             flag: '🇧🇪' },
  POL: { name: 'Poland',              flag: '🇵🇱' },
  SCO: { name: 'Scotland',            flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  UKR: { name: 'Ukraine',             flag: '🇺🇦' },
  BIH: { name: 'Bosnia & Herzegovina',flag: '🇧🇦' },
  CZE: { name: 'Czech Republic',      flag: '🇨🇿' },
  SVN: { name: 'Slovenia',            flag: '🇸🇮' },
  ROU: { name: 'Romania',             flag: '🇷🇴' },
  GRE: { name: 'Greece',              flag: '🇬🇷' },
  NOR: { name: 'Norway',              flag: '🇳🇴' },
  WAL: { name: 'Wales',               flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
  FIN: { name: 'Finland',             flag: '🇫🇮' },

  // North/Central America & Caribbean
  USA: { name: 'USA',                 flag: '🇺🇸' },
  MEX: { name: 'Mexico',              flag: '🇲🇽' },
  CAN: { name: 'Canada',              flag: '🇨🇦' },
  PAN: { name: 'Panama',              flag: '🇵🇦' },
  JAM: { name: 'Jamaica',             flag: '🇯🇲' },
  HND: { name: 'Honduras',            flag: '🇭🇳' },
  CRC: { name: 'Costa Rica',          flag: '🇨🇷' },
  CUB: { name: 'Cuba',                flag: '🇨🇺' },

  // Asia
  JPN: { name: 'Japan',               flag: '🇯🇵' },
  KOR: { name: 'South Korea',         flag: '🇰🇷' },
  AUS: { name: 'Australia',           flag: '🇦🇺' },
  IRN: { name: 'Iran',                flag: '🇮🇷' },
  KSA: { name: 'Saudi Arabia',        flag: '🇸🇦' },
  JOR: { name: 'Jordan',              flag: '🇯🇴' },
  UZB: { name: 'Uzbekistan',          flag: '🇺🇿' },
  IRQ: { name: 'Iraq',                flag: '🇮🇶' },
  QAT: { name: 'Qatar',               flag: '🇶🇦' },
  CHN: { name: 'China',               flag: '🇨🇳' },
  THA: { name: 'Thailand',            flag: '🇹🇭' },
  IDN: { name: 'Indonesia',           flag: '🇮🇩' },

  // Africa
  MAR: { name: 'Morocco',             flag: '🇲🇦' },
  EGY: { name: 'Egypt',               flag: '🇪🇬' },
  NGA: { name: 'Nigeria',             flag: '🇳🇬' },
  SEN: { name: 'Senegal',             flag: '🇸🇳' },
  CIV: { name: 'Ivory Coast',         flag: '🇨🇮' },
  CMR: { name: 'Cameroon',            flag: '🇨🇲' },
  GHA: { name: 'Ghana',               flag: '🇬🇭' },
  ALG: { name: 'Algeria',             flag: '🇩🇿' },
  MLI: { name: 'Mali',                flag: '🇲🇱' },
  RSA: { name: 'South Africa',        flag: '🇿🇦' },
  TUN: { name: 'Tunisia',             flag: '🇹🇳' },
  TGO: { name: 'Togo',                flag: '🇹🇬' },
  GAB: { name: 'Gabon',               flag: '🇬🇦' },
  ZIM: { name: 'Zimbabwe',            flag: '🇿🇼' },

  // Oceania
  NZL: { name: 'New Zealand',         flag: '🇳🇿' },
  FIJ: { name: 'Fiji',                flag: '🇫🇯' },

  // Additional WC 2026 qualifiers confirmed by ESPN fixture data
  SWE: { name: 'Sweden',              flag: '🇸🇪' },
  HAI: { name: 'Haiti',               flag: '🇭🇹' },
  CUW: { name: 'Curaçao',             flag: '🇨🇼' },
  CPV: { name: 'Cape Verde',          flag: '🇨🇻' },
  COD: { name: 'Congo DR',            flag: '🇨🇩' },
};

// ESPN occasionally uses non-standard TLAs — remap to our canonical ones.
const ESPN_REMAP = { HOL: 'NED', CZK: 'CZE' };

export function normalizeTla(tla) {
  if (!tla) return null;
  const up = String(tla).toUpperCase();
  return ESPN_REMAP[up] ?? up;
}

/// Short visual token for a team: a flag for nations, initials otherwise.
export function badgeFor(id, displayName, mode) {
  if (mode === 'flags') return NATION_FLAGS[id]?.flag ?? '\u{1F3F3}\u{FE0F}';
  if (!displayName) return id.slice(0, 3).toUpperCase();
  // "Real Madrid" -> "RM", "Arsenal" -> "AR". Keeps badges short and neutral.
  const words = displayName.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function nameFor(id, displayName, mode) {
  if (mode === 'flags') return NATION_FLAGS[id]?.name ?? displayName ?? id;
  return displayName ?? id;
}
