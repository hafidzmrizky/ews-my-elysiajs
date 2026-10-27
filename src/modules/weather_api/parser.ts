import { SUB_REGION_DISTRICT_MAP, resolveStateCode, normalizeDistrictName, getDistrictsByState, getStateName } from "../geolocation";
import type { RawWeatherWarning, ParsedAdvisory, TargetDistrict, StateInfo } from "./types";

/**
 * create advisory id
 */
export function createAdvisoryId(raw: RawWeatherWarning, index: number): string {
  const issued = raw.warning_issue?.issued || "";
  const title = (raw.warning_issue?.title_bm || raw.heading_bm || "warning")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-");
  const validTo = raw.valid_to || "";
  const base = `${issued}_${validTo}_${title}`.replace(/[:T\-]/g, "").slice(0, 40);
  return base ? `adv_${base}` : `adv_${index}_${Date.now()}`;
}

/**
 * splits the list delimited by comma and the conjunction "dan"/"and"! 
 */
function splitDistrictList(text: string): string[] {
  return text
    .split(/,|\bdan\b|\band\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.toLowerCase().startsWith("dan") && !s.toLowerCase().startsWith("and"));
}

/**
 * check if the time is still valid
 */
export function isExpired(validTo?: string | null): boolean {
  if (!validTo) return true;
  const toDate = new Date(validTo);
  if (isNaN(toDate.getTime())) return true;
  return toDate.getTime() >= Date.now();
}

/**
 * parse the land warning
 */
function parseLandBulletin(text: string): {
  wholeStates: StateInfo[];
  districts: TargetDistrict[];
} {
  const wholeStatesMap = new Map<string, StateInfo>();
  const districts: TargetDistrict[] = [];
  const seenDistricts = new Set<string>();

  const addDistrict = (stateCode: string, rawDist: string) => {
    const canonicalName = normalizeDistrictName(rawDist, stateCode);
    const slug = canonicalName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
    const key = `${stateCode}:${slug}`;
    if (!seenDistricts.has(key)) {
      seenDistricts.add(key);
      districts.push({
        state: stateCode,
        state_name: getStateName(stateCode),
        district: canonicalName,
        district_slug: slug,
      });
    }
  };

  const addWholeState = (stateCode: string) => {
    wholeStatesMap.set(stateCode, {
      state: stateCode,
      state_name: getStateName(stateCode),
    });
    // get the state's districts
    const allDistricts = getDistrictsByState(stateCode);
    for (const d of allDistricts) {
      addDistrict(stateCode, d);
    }
  };

  // btw, they r seperated by the • (\u2022), so we can split based on that
  const segments = text.split(/[•\u2022]/);

  for (const rawSeg of segments) {
    let seg = rawSeg.trim();
    if (!seg) continue;
    // clean preamble in order to get the list of states and districts
    seg = seg.replace(/^.*?(?:dijangka|expected)\s+(?:berlaku\s+)?(?:di\s+|to\s+occur\s+over\s+)?(?:negeri\s+|the\s+states?\s+of\s+)?/i, "");
    // to get clean ending 
    seg = seg.replace(/(?:sehingga|until)\s+.*$/i, "").trim();

    if (!seg) continue;

    // east malaysia
    const eastMatch = seg.match(/^(sarawak|sabah):\s*(.*)$/i);
    if (eastMatch) {
      const stateKey = eastMatch[1].toLowerCase();
      const stateCode = resolveStateCode(stateKey);
      if (stateCode) {
        const body = eastMatch[2].trim();
        // match divisions or sub-blocks 
        const subBlocks = body.match(/[^,()]+\([^)]*\)|[^,()]+/g) || [];
        for (const sub of subBlocks) {
          const item = sub.trim();
          if (!item) continue;

          const paren = item.match(/^([^(]+)\(([^)]+)\)$/);
          if (paren) {
            const innerList = splitDistrictList(paren[2]);
            for (const d of innerList) {
              addDistrict(stateCode, d);
            }
          } else {
            // check subregion
            const lowerItem = item.toLowerCase();
            const subReg = SUB_REGION_DISTRICT_MAP[lowerItem];
            if (subReg) {
              for (const d of subReg.districts) {
                addDistrict(subReg.state, d);
              }
            } else {
              addDistrict(stateCode, item);
            }
          }
        }
      }
      continue;
    }

    // peninsular, state w parentheses -> in the data -> "Negeri Sembilan (Jelebu)"
    const parenMatch = seg.match(/^([^(]+)\(([^)]+)\)$/);
    if (parenMatch) {
      const statePart = parenMatch[1].trim();
      const stateCode = resolveStateCode(statePart);

      if (stateCode) {
        const innerList = splitDistrictList(parenMatch[2]);
        for (const d of innerList) {
          addDistrict(stateCode, d);
        }
      }
      continue;
    }

    // whole state without parentheses in the data
    const stateCode = resolveStateCode(seg);
    if (stateCode) {
      addWholeState(stateCode);
    }
  }

  return {
    wholeStates: Array.from(wholeStatesMap.values()),
    districts,
  };
}

/**
 * parse the marine warning (angin kencang dan laut bergelora)
 */
function parseMarineBulletin(text: string): {
  wholeStates: StateInfo[];
  marineStates: StateInfo[];
  districts: TargetDistrict[];
} {
  const wholeStatesMap = new Map<string, StateInfo>();
  const marineStatesMap = new Map<string, StateInfo>();
  const districts: TargetDistrict[] = [];
  const seenDistricts = new Set<string>();

  const addState = (code: string) => {
    const name = getStateName(code);
    wholeStatesMap.set(code, { state: code, state_name: name });
    marineStatesMap.set(code, { state: code, state_name: name });
  };

  const addDistrict = (stateCode: string, distName: string) => {
    const canonicalName = normalizeDistrictName(distName, stateCode);
    const slug = canonicalName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
    const key = `${stateCode}:${slug}`;
    if (!seenDistricts.has(key)) {
      seenDistricts.add(key);
      districts.push({
        state: stateCode,
        state_name: getStateName(stateCode),
        district: canonicalName,
        district_slug: slug,
      });
    }
  };

  // match all instances of waters in da data
  const regex = /(?:kawasan\s+perairan|waters\s+of)\s+(.+?)(?=\s+(?:sehingga|until|keadaan|this\s+condition)|$)/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const rawList = match[1];
    const items = rawList.split(/[•\u2022,]/).map((s) => s.trim()).filter(Boolean);

    for (const rawItem of items) {
      const lower = rawItem.toLowerCase().trim();
      if (!lower) continue;

      // check subregion
      const subReg = SUB_REGION_DISTRICT_MAP[lower];
      if (subReg) {
        addState(subReg.state);
        for (const d of subReg.districts) {
          addDistrict(subReg.state, d);
        }
        continue;
      }

      // check canonical state 
      const stateCode = resolveStateCode(lower);
      if (stateCode) {
        addState(stateCode);
        const allDists = getDistrictsByState(stateCode);
        for (const d of allDists) {
          addDistrict(stateCode, d);
        }
      }
    }
  }

  return {
    wholeStates: Array.from(wholeStatesMap.values()),
    marineStates: Array.from(marineStatesMap.values()),
    districts,
  };
}

/**
 * transforms raw MET API into parsed advisory objects
 */
export function parseWeatherWarnings(rawWarnings: RawWeatherWarning[]): ParsedAdvisory[] {
  if (!Array.isArray(rawWarnings)) return [];

  const parsedList: ParsedAdvisory[] = [];

  rawWarnings.forEach((raw, idx) => {
    const titleBm = raw.warning_issue?.title_bm || raw.heading_bm || "Amaran Cuaca";
    const titleEn = raw.warning_issue?.title_en || raw.heading_en || "Weather Warning";
    const headingBm = raw.heading_bm || titleBm;
    const headingEn = raw.heading_en || titleEn;
    const textBm = raw.text_bm || "";
    const textEn = raw.text_en || "";

    // ignore no adv
    if (
      titleBm.toLowerCase().includes("tiada nasihat") ||
      titleEn.toLowerCase().includes("no advisory") ||
      textBm.includes("Tiada sistem Siklon Tropika")
    ) {
      return;
    }

    const id = createAdvisoryId(raw, idx);
    const active = isExpired(raw.valid_to);

    const isMarine =
      titleBm.toLowerCase().includes("laut bergelora") ||
      titleBm.toLowerCase().includes("angin kencang") ||
      titleEn.toLowerCase().includes("strong winds") ||
      titleEn.toLowerCase().includes("rough seas") ||
      textBm.toLowerCase().includes("seksyen a: untuk perairan") ||
      textEn.toLowerCase().includes("section a: for malaysian waters");

    let wholeStates: StateInfo[] = [];
    let districts: TargetDistrict[] = [];
    let marineStates: StateInfo[] = [];

    if (isMarine) {
      const marineParsed = parseMarineBulletin(textBm || textEn);
      wholeStates = marineParsed.wholeStates;
      marineStates = marineParsed.marineStates;
      districts = marineParsed.districts;
    } else {
      const landParsed = parseLandBulletin(textBm || textEn);
      wholeStates = landParsed.wholeStates;
      districts = landParsed.districts;
    }

    parsedList.push({
      id,
      title_bm: titleBm,
      title_en: titleEn,
      heading_bm: headingBm,
      heading_en: headingEn,
      issued: raw.warning_issue?.issued || null,
      valid_from: raw.valid_from || null,
      valid_to: raw.valid_to || null,
      is_active: active,
      type: isMarine ? "marine" : "land",
      whole_states: wholeStates,
      districts,
      marine_states: marineStates,
      text_bm: textBm,
      text_en: textEn,
      instruction_bm: raw.instruction_bm,
      instruction_en: raw.instruction_en,
    });
  });

  return parsedList;
}
