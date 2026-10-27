import type { StateMetadata, RegionDefinition } from "./types";

export const MALAYSIA_STATES: Record<string, StateMetadata> = {
    JHR: {
        id: 1,
        code: "JHR",
        name: "Johor",
        aliases: ["johor", "johore", "jhr"],
    },
    KDH: {
        id: 2,
        code: "KDH",
        name: "Kedah",
        aliases: ["kedah", "kdh"],
    },
    KTN: {
        id: 3,
        code: "KTN",
        name: "Kelantan",
        aliases: ["kelantan", "ktn"],
    },
    MLK: {
        id: 4,
        code: "MLK",
        name: "Melaka",
        aliases: ["melaka", "malacca", "mlk"],
    },
    NSN: {
        id: 5,
        code: "NSN",
        name: "Negeri Sembilan",
        aliases: ["negeri sembilan", "n. sembilan", "n.sembilan", "n sembilan", "nsn"],
    },
    PHG: {
        id: 6,
        code: "PHG",
        name: "Pahang",
        aliases: ["pahang", "phg"],
    },
    PNG: {
        id: 7,
        code: "PNG",
        name: "Pulau Pinang",
        aliases: ["pulau pinang", "penang", "p. pinang", "p pinang", "p.pinang", "png"],
    },
    PRK: {
        id: 8,
        code: "PRK",
        name: "Perak",
        aliases: ["perak", "prk"],
    },
    PLS: {
        id: 9,
        code: "PLS",
        name: "Perlis",
        aliases: ["perlis", "pls"],
    },
    SGR: {
        id: 10,
        code: "SGR",
        name: "Selangor",
        aliases: ["selangor", "sgr"],
    },
    TRG: {
        id: 11,
        code: "TRG",
        name: "Terengganu",
        aliases: ["terengganu", "trengganu", "trg"],
    },
    SBH: {
        id: 12,
        code: "SBH",
        name: "Sabah",
        aliases: ["sabah", "sbh"],
    },
    SWK: {
        id: 13,
        code: "SWK",
        name: "Sarawak",
        aliases: ["sarawak", "swk"],
    },
    KUL: {
        id: 14,
        code: "KUL",
        name: "W.P. Kuala Lumpur",
        aliases: [
            "w.p. kuala lumpur",
            "wp kuala lumpur",
            "w.p kuala lumpur",
            "wp k lumpur",
            "kuala lumpur",
            "kl",
            "kul",
        ],
    },
    LBN: {
        id: 15,
        code: "LBN",
        name: "W.P. Labuan",
        aliases: ["w.p. labuan", "wp labuan", "w.p labuan", "labuan", "lbn"],
    },
    PJY: {
        id: 16,
        code: "PJY",
        name: "W.P. Putrajaya",
        aliases: ["w.p. putrajaya", "wp putrajaya", "w.p putrajaya", "putrajaya", "pjy"],
    },
};


export const STATE_ALIAS_MAP: Record<string, string> = {};
for (const state of Object.values(MALAYSIA_STATES)) {
    STATE_ALIAS_MAP[state.code.toLowerCase()] = state.code;
    STATE_ALIAS_MAP[state.name.toLowerCase()] = state.code;
    for (const alias of state.aliases) {
        STATE_ALIAS_MAP[alias.toLowerCase()] = state.code;
    }
}

// sub-region to state & districts mapping
export const SUB_REGION_DISTRICT_MAP: Record<string, RegionDefinition> = {
    // johor
    "johor barat": { state: "JHR", districts: ["Batu Pahat", "Pontian", "Muar", "Tangkak"] },
    "west johor": { state: "JHR", districts: ["Batu Pahat", "Pontian", "Muar", "Tangkak"] },
    "johor timur": { state: "JHR", districts: ["Mersing", "Kota Tinggi"] },
    "east johor": { state: "JHR", districts: ["Mersing", "Kota Tinggi"] },
    "johor selatan": { state: "JHR", districts: ["Johor Bahru", "Kulai", "Pontian"] },
    "south johor": { state: "JHR", districts: ["Johor Bahru", "Kulai", "Pontian"] },

    // sarawak
    "sarawak barat": { state: "SWK", districts: ["Kuching", "Bau", "Lundu", "Samarahan", "Asajaya", "Serian", "Simunjan"] },
    "western sarawak": { state: "SWK", districts: ["Kuching", "Bau", "Lundu", "Samarahan", "Asajaya", "Serian", "Simunjan"] },
    "sarawak tengah": { state: "SWK", districts: ["Sibu", "Mukah", "Sarikei", "Betong", "Kanowit", "Kapit", "Dalat"] },
    "central sarawak": { state: "SWK", districts: ["Sibu", "Mukah", "Sarikei", "Betong", "Kanowit", "Kapit", "Dalat"] },
    "sarawak utara": { state: "SWK", districts: ["Miri", "Bintulu", "Limbang", "Lawas", "Subis", "Beluru"] },
    "northern sarawak": { state: "SWK", districts: ["Miri", "Bintulu", "Limbang", "Lawas", "Subis", "Beluru"] },

    // sabah
    "pedalaman": { state: "SBH", districts: ["Keningau", "Tambunan", "Nabawan", "Tenom", "Beaufort", "Sipitang"] },
    "interior": { state: "SBH", districts: ["Keningau", "Tambunan", "Nabawan", "Tenom", "Beaufort", "Sipitang"] },
    "pantai barat": { state: "SBH", districts: ["Kota Kinabalu", "Penampang", "Putatan", "Papar", "Tuaran", "Kota Belud", "Ranau"] },
    "west coast": { state: "SBH", districts: ["Kota Kinabalu", "Penampang", "Putatan", "Papar", "Tuaran", "Kota Belud", "Ranau"] },
    "kudat": { state: "SBH", districts: ["Kudat", "Kota Marudu", "Pitas"] },
    "sandakan": { state: "SBH", districts: ["Sandakan", "Beluran", "Telupid", "Kinabatangan"] },
    "tawau": { state: "SBH", districts: ["Tawau", "Lahad Datu", "Kunak", "Semporna", "Kalabakan"] },

    // maritime
    "tioman": { state: "PHG", districts: ["Rompin", "Mersing"] },
    "selat melaka": { state: "MLK", districts: ["Melaka Tengah", "Alor Gajah", "Jasin", "Port Dickson", "Klang"] },
    "straits of melaka": { state: "MLK", districts: ["Melaka Tengah", "Alor Gajah", "Jasin", "Port Dickson", "Klang"] },
};

// aliases
export const DISTRICT_ALIASES: Record<string, string> = {
    // sabah
    "pensiangan": "Nabawan",
    "pedalaman": "Keningau",
    "pantai barat": "Kota Kinabalu",

    // sarawak
    "sebuyau": "Simunjan",
    "gedong": "Simunjan",
    "siburan": "Serian",
    "tanjung manis": "Tanjung Manis",

    // peninsular
    "larut matang": "Larut Dan Matang",
    "larut": "Larut Dan Matang",
    "matang": "Larut Dan Matang",
    "selama": "Selama",
    "larut matang dan selama": "Larut Dan Matang",
    "hulu langat": "Ulu Langat",
    "hulu selangor": "Ulu Selangor",
    "hulu perak": "Hulu Perak",
    "ulu perak": "Hulu Perak",
    "hulu terengganu": "Hulu Terengganu",
    "ulu terengganu": "Hulu Terengganu",
    "bandar baru": "Bandar Baharu",
    "kota baru": "Kota Bharu",
    "lojing": "Kecil Lojing",
    "seberang perai": "Seberang Perai Tengah",
};

// bounding box for entire Malaysia region [minLng, minLat, maxLng, maxLat]
export const MALAYSIA_BOUNDS = {
    minLng: 98.0,
    maxLng: 120.0,
    minLat: 0.5,
    maxLat: 8.0,
};


export const MALAYSIA_ANCHORS = [
    { name: "Kudat, Sabah", lat: 6.8837, lng: 116.8485 },
    { name: "Pulau Banggi, Sabah", lat: 7.2500, lng: 117.1667 },
    { name: "Ranau, Sabah", lat: 5.9538, lng: 116.6641 },
    { name: "Kota Kinabalu, Sabah", lat: 5.9804, lng: 116.0735 },
    { name: "Lahad Datu, Sabah", lat: 5.0268, lng: 118.3270 },
    { name: "Semporna, Sabah", lat: 4.4811, lng: 118.6111 },
    { name: "Tawau, Sabah", lat: 4.2447, lng: 117.8912 },
    { name: "Miri, Sarawak", lat: 4.3995, lng: 113.9914 },
    { name: "Bintulu, Sarawak", lat: 3.1667, lng: 113.0333 },
    { name: "Kuching, Sarawak", lat: 1.5533, lng: 110.3592 },
    { name: "Pulau Langkawi, Kedah", lat: 6.3500, lng: 99.8000 },
    { name: "George Town, Penang", lat: 5.4141, lng: 100.3288 },
    { name: "Kota Bharu, Kelantan", lat: 6.1254, lng: 102.2386 },
    { name: "Kuala Terengganu, Terengganu", lat: 5.3117, lng: 103.1324 },
    { name: "Kuantan, Pahang", lat: 3.8077, lng: 103.3260 },
    { name: "Kuala Lumpur", lat: 3.1390, lng: 101.6869 },
    { name: "Johor Bahru, Johor", lat: 1.4927, lng: 103.7414 },
] as const;