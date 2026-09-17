// Best-effort parse of a Steam/CSFloat market_hash_name into filterable
// parts. There's no catalog backing this -- it's just string structure
// ("[StatTrak(TM) ][*] Weapon | Skin (Wear)"), so treat results as hints
// for filtering, not authoritative metadata.

export interface ParsedSkinName {
  weapon: string | null;
  skin: string | null;
  wear: string | null;
  statTrak: boolean;
  souvenir: boolean;
}

export function parseMarketHashName(name: string): ParsedSkinName {
  const wearMatch = name.match(/\(([^)]+)\)\s*$/);
  const wear = wearMatch ? wearMatch[1] : null;
  const withoutWear = wearMatch ? name.slice(0, wearMatch.index).trim() : name.trim();

  const [weaponPart, skinPart] = withoutWear.split("|").map((s) => s?.trim());

  const statTrak = /StatTrak/i.test(weaponPart ?? "");
  const souvenir = /Souvenir/i.test(weaponPart ?? "");
  const weapon = (weaponPart ?? "")
    .replace(/★\s*/g, "")
    .replace(/StatTrak(?:™|™)?\s*/gi, "")
    .replace(/Souvenir\s*/gi, "")
    .trim();

  return {
    weapon: weapon || null,
    skin: skinPart || null,
    wear,
    statTrak,
    souvenir,
  };
}
