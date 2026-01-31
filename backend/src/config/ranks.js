/**
 * Rank tiers for Cyber-ELO (visible progression).
 * RP range: 0–100 per rank. MMR is hidden; rank is derived from MMR.
 */

export const RANKS = [
  { name: 'Script Kiddie', min: 0 },
  { name: 'Initiate', min: 800 },
  { name: 'Packet Sniffer', min: 1000 },
  { name: 'Exploit Crafter', min: 1200 },
  { name: 'Red Operator', min: 1400 },
  { name: 'Blue Sentinel', min: 1600 },
  { name: 'APT Unit', min: 1800 },
  { name: 'Zero-Day', min: 2100 },
];

export const RP_MIN = 0;
export const RP_MAX = 100;
