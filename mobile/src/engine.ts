// Mausam 2.0 — client-side personalization engine (RN port).
// Mirrors backend/services impact_models.py / ranking.py / homepage.py so the
// app behaves like the real API contract, fully offline for the demo.

export type Lang = 'en' | 'hi';
export type ScenarioKey =
  | 'clear'
  | 'clean_air_morning'
  | 'aqi_spike'
  | 'heatwave'
  | 'rainy_commute'
  | 'cyclone'
  | 'beach_day'
  | 'frost_night';
export type PersonaKey =
  | 'health'
  | 'fitness'
  | 'beach'
  | 'travel'
  | 'parent'
  | 'agriculture'
  | 'commuter'
  | 'events';
export type Phase = 'official' | 'derived' | 'informational';
export type Severity = 'green' | 'yellow' | 'orange' | 'red';
export type Source = 'IMD' | 'CPCB' | 'INCOIS' | 'ISRO' | 'Open-Meteo' | 'Mausam Engine';
export type Condition =
  | 'sunny' | 'partly' | 'cloudy' | 'rain' | 'storm' | 'haze' | 'fog' | 'cold' | 'hot' | 'night';
export type CardType =
  | 'severe_warning' | 'my_day' | 'mausam_brief' | 'aqi' | 'uv' | 'pollen' | 'humidity'
  | 'heat_stress' | 'running_window' | 'cycling_window' | 'outdoor_comfort' | 'school_commute'
  | 'work_commute' | 'rain_timeline' | 'fog_alert' | 'farm_irrigation' | 'farm_frost'
  | 'farm_planting' | 'beach_safety' | 'tide_info' | 'surf_conditions' | 'event_weather'
  | 'travel_destination' | 'packing_advisor' | 'sunrise_sunset';

export interface WeatherParams {
  temp: number; feelsLike: number; humidity: number; wind: number; gust: number;
  precip: number; rainProb: number; visibility: number; uv: number; aqi: number; pm25: number;
  wave?: number; waterTemp?: number; soil: number; heatIndex: number; pollen: number;
  condition: Condition;
}

export interface WarningDef {
  severity: Severity; source: Source; event: string;
  headline: string; headlineHi: string; body: string; bodyHi: string;
  actions: string[]; actionsHi: string[]; validHours: number;
}

export interface ScenarioDef {
  key: ScenarioKey; label: string; labelHi: string; emoji: string; condition: Condition;
  desc: string; params: Partial<WeatherParams>; warning?: WarningDef;
}

export interface City {
  key: string; name: string; nameHi: string; state: string; coastal: boolean; farm: boolean;
  lat: number; lon: number;
  defaultScenario: ScenarioKey; sunrise: string; sunset: string;
}

export type ActivityType =
  | 'run' | 'cycle' | 'walk' | 'yoga' | 'commute' | 'school_drop' | 'school_pickup'
  | 'farm_work' | 'event' | 'swim' | 'travel';

export interface Activity { type: ActivityType; label: string; labelHi: string; time: string; }

export interface SavedLocation { type: 'home' | 'work' | 'school' | 'farm'; label: string; }

export interface UserProfile {
  id: string; name: string; nameHi: string; personas: PersonaKey[]; conditions: string[];
  activities: Activity[]; locations: SavedLocation[]; city: string; language: Lang;
  behaviorBias: Partial<Record<CardType, number>>;
}

export interface Factor { name: string; nameHi: string; value: string; impact: 'good' | 'neutral' | 'bad'; }
export interface RankingBreakdown { interest: number; context: number; urgency: number; time: number; location: number; behavior: number; }

export interface Card {
  id: string; type: CardType; persona: PersonaKey; title: string; summary: string;
  score?: number; level?: string; phase: Phase; severity?: Severity; bestWindow?: string;
  factors?: Factor[]; actions?: string[]; data: Record<string, unknown>;
  rank: number; priority: number;
  explanation: { why: string; source: Source; confidence: number; validUntil: string; ranking: RankingBreakdown };
  provenance: { source: Source; issuedAt: string; validFrom: string; validUntil: string; licence: string };
}

export interface HourPoint { hour: number; temp: number; rainProb: number; aqi: number; uv: number; wind: number; condition: Condition; }
export interface DayPoint { label: string; labelHi: string; hi: number; lo: number; rainProb: number; condition: Condition; }

export interface Provider { name: Source; status: 'ok' | 'degraded' | 'down'; latencyMs: number; }

export interface Homepage {
  user: UserProfile; city: City; scenario: ScenarioDef; params: WeatherParams; hour: number;
  pinned: Card[]; cards: Card[]; hourly: HourPoint[]; daily: DayPoint[];
  brief: string; myDay: MyDayItem[]; freshness: string; providers: Provider[];
}

export interface MyDayItem {
  activity: Activity; hour: number; score: number; status: 'go' | 'shift' | 'avoid';
  note: string; suggestion?: string; point: HourPoint;
}

/** Real observed weather injected from a live source (e.g. Open-Meteo). */
export interface LiveWeather {
  params: WeatherParams;
  hourly: HourPoint[];
  daily: DayPoint[];
  fetchedAt: string;
  stale: boolean;
}

// ---------------------------------------------------------------- catalogs

export const PERSONAS: Record<PersonaKey, { label: string; labelHi: string; icon: string; color: string; soft: string; desc: string; descHi: string }> = {
  health: { label: 'Health', labelHi: 'स्वास्थ्य', icon: '🫁', color: '#2E7D32', soft: '#E8F5E9', desc: 'AQI, pollen, UV, heat', descHi: 'AQI, पराग, UV, गर्मी' },
  fitness: { label: 'Fitness', labelHi: 'फ़िटनेस', icon: '🏃', color: '#F57C00', soft: '#FFF3E0', desc: 'Best time to run / cycle', descHi: 'दौड़ने / साइकिल का सही समय' },
  beach: { label: 'Beach & Surf', labelHi: 'समुद्र तट', icon: '🏖️', color: '#1565C0', soft: '#E3F2FD', desc: 'Tides, waves, safety', descHi: 'ज्वार, लहरें, सुरक्षा' },
  travel: { label: 'Travel', labelHi: 'यात्रा', icon: '✈️', color: '#6A1B9A', soft: '#F3E5F5', desc: 'Destination advisories', descHi: 'गंतव्य सलाह' },
  parent: { label: 'Parent & Family', labelHi: 'परिवार', icon: '👨‍👩‍👧', color: '#C2185B', soft: '#FCE4EC', desc: 'School commute, rain', descHi: 'स्कूल आवागमन, बारिश' },
  agriculture: { label: 'Farming', labelHi: 'खेती', icon: '🌾', color: '#00695C', soft: '#E0F2F1', desc: 'Irrigation, frost, planting', descHi: 'सिंचाई, पाला, बुवाई' },
  commuter: { label: 'Commuter', labelHi: 'यात्री', icon: '🚗', color: '#455A64', soft: '#ECEFF1', desc: 'Route weather, fog, storm', descHi: 'मार्ग मौसम, कोहरा, तूफ़ान' },
  events: { label: 'Events', labelHi: 'आयोजन', icon: '🎉', color: '#E65100', soft: '#FBE9E7', desc: 'Outdoor event windows', descHi: 'बाहरी आयोजन समय' },
};

export const PERSONA_INTERESTS: Record<PersonaKey, CardType[]> = {
  health: ['aqi', 'pollen', 'uv', 'heat_stress', 'humidity'],
  fitness: ['running_window', 'cycling_window', 'outdoor_comfort', 'uv', 'aqi'],
  beach: ['beach_safety', 'tide_info', 'surf_conditions', 'uv'],
  travel: ['travel_destination', 'packing_advisor', 'rain_timeline'],
  parent: ['school_commute', 'rain_timeline', 'uv', 'aqi', 'heat_stress'],
  agriculture: ['farm_frost', 'farm_irrigation', 'farm_planting', 'rain_timeline'],
  commuter: ['work_commute', 'rain_timeline', 'fog_alert'],
  events: ['event_weather', 'rain_timeline', 'sunrise_sunset'],
};

export const CITIES: City[] = [
  { key: 'pune', name: 'Pune', nameHi: 'पुणे', state: 'Maharashtra', coastal: false, farm: false, lat: 18.5204, lon: 73.8567, defaultScenario: 'clear', sunrise: '06:32', sunset: '18:41' },
  { key: 'delhi', name: 'Delhi', nameHi: 'दिल्ली', state: 'Delhi', coastal: false, farm: false, lat: 28.6139, lon: 77.2090, defaultScenario: 'aqi_spike', sunrise: '06:48', sunset: '17:52' },
  { key: 'mumbai', name: 'Mumbai', nameHi: 'मुंबई', state: 'Maharashtra', coastal: true, farm: false, lat: 19.0760, lon: 72.8777, defaultScenario: 'rainy_commute', sunrise: '06:39', sunset: '18:47' },
  { key: 'chennai', name: 'Chennai', nameHi: 'चेन्नई', state: 'Tamil Nadu', coastal: true, farm: false, lat: 13.0827, lon: 80.2707, defaultScenario: 'beach_day', sunrise: '06:05', sunset: '18:04' },
  { key: 'kochi', name: 'Kochi', nameHi: 'कोच्चि', state: 'Kerala', coastal: true, farm: false, lat: 9.9312, lon: 76.2673, defaultScenario: 'cyclone', sunrise: '06:28', sunset: '18:31' },
  { key: 'chandigarh', name: 'Chandigarh', nameHi: 'चंडीगढ़', state: 'Punjab', coastal: false, farm: true, lat: 30.7333, lon: 76.7794, defaultScenario: 'frost_night', sunrise: '07:02', sunset: '17:38' },
  { key: 'kolkata', name: 'Kolkata', nameHi: 'कोलकाता', state: 'West Bengal', coastal: false, farm: true, lat: 22.5726, lon: 88.3639, defaultScenario: 'clean_air_morning', sunrise: '05:58', sunset: '17:09' },
  { key: 'bengaluru', name: 'Bengaluru', nameHi: 'बेंगलुरु', state: 'Karnataka', coastal: false, farm: false, lat: 12.9716, lon: 77.5946, defaultScenario: 'heatwave', sunrise: '06:22', sunset: '18:18' },
];

export const SCENARIOS: ScenarioDef[] = [
  { key: 'clear', label: 'Clear day', labelHi: 'साफ़ दिन', emoji: '☀️', condition: 'sunny', desc: 'Baseline — everything favourable', params: { aqi: 58, uv: 6, precip: 0, rainProb: 12, wind: 8, temp: 26, humidity: 48, pollen: 4 } },
  { key: 'clean_air_morning', label: 'Clean-air morning', labelHi: 'स्वच्छ हवा सुबह', emoji: '🌤️', condition: 'partly', desc: 'Rare AQI 38 — nudge outdoor activity', params: { aqi: 38, uv: 3, precip: 0, rainProb: 5, wind: 6, temp: 21, humidity: 55, pollen: 2 } },
  {
    key: 'aqi_spike', label: 'AQI spike', labelHi: 'AQI उछाल', emoji: '😷', condition: 'haze',
    desc: 'Very Poor air — health persona takes over',
    params: { aqi: 312, uv: 5, precip: 0, rainProb: 4, wind: 4, temp: 19, humidity: 62, visibility: 1.8, pollen: 6 },
    warning: {
      severity: 'orange', source: 'CPCB', event: 'Air Quality',
      headline: 'Air quality Very Poor — GRAP Stage III', headlineHi: 'वायु गुणवत्ता बहुत खराब — GRAP चरण III',
      body: 'AQI 312 (PM2.5 187 µg/m³). Sensitive groups avoid outdoor exertion; keep N95 handy; schools may shift outdoor sports indoors.',
      bodyHi: 'AQI 312 (PM2.5 187 µg/m³)। संवेदनशील लोग बाहर परिश्रम से बचें; N95 साथ रखें; स्कूल आउटडोर खेल अंदर करें।',
      actions: ['Avoid outdoor exertion', 'Wear N95 outdoors', 'Run purifier at home'],
      actionsHi: ['बाहर परिश्रम से बचें', 'बाहर N95 पहनें', 'घर पर प्यूरीफ़ायर चलाएँ'], validHours: 18,
    },
  },
  {
    key: 'heatwave', label: 'Heat wave', labelHi: 'लू', emoji: '🥵', condition: 'hot',
    desc: '42 °C — IMD orange warning pinned',
    params: { aqi: 110, uv: 10, precip: 0, rainProb: 8, wind: 5, temp: 42, humidity: 22, pollen: 3 },
    warning: {
      severity: 'orange', source: 'IMD', event: 'Heat Wave',
      headline: 'Heat wave warning — 42 °C, 5 °C above normal', headlineHi: 'लू की चेतावनी — 42 °C, सामान्य से 5 °C अधिक',
      body: 'Heat wave conditions likely in isolated pockets. Avoid outdoor exposure 12–4 PM, hydrate frequently, check on elderly and children.',
      bodyHi: 'अलग-अलग इलाकों में लू की स्थिति। दोपहर 12–4 बजे बाहर न निकलें, बार-बार पानी पिएँ, बुज़ुर्गों और बच्चों का ध्यान रखें।',
      actions: ['Stay indoors 12–4 PM', 'Drink ORS / water hourly', 'Check on elderly'],
      actionsHi: ['12–4 बजे अंदर रहें', 'हर घंटे पानी / ORS', 'बुज़ुर्गों का ध्यान रखें'], validHours: 30,
    },
  },
  {
    key: 'rainy_commute', label: 'Rainy commute', labelHi: 'बरसाती सफ़र', emoji: '🌧️', condition: 'rain',
    desc: '85% rain at office hours — commuter & parent',
    params: { aqi: 60, uv: 2, precip: 12, rainProb: 85, wind: 18, temp: 24, humidity: 91, visibility: 3, wave: 2.4, pollen: 1 },
    warning: {
      severity: 'yellow', source: 'IMD', event: 'Heavy Rain',
      headline: 'Heavy rain likely at isolated places', headlineHi: 'अलग-अलग स्थानों पर भारी बारिश की संभावना',
      body: 'Intense spells 8–11 AM and 5–8 PM. Waterlogging expected in low-lying areas; allow 25–40 extra minutes for travel.',
      bodyHi: 'सुबह 8–11 और शाम 5–8 बजे तेज़ बौछारें। निचले इलाकों में जलभराव; यात्रा में 25–40 मिनट अतिरिक्त रखें।',
      actions: ['Leave 30 min early', 'Avoid underpasses', 'Carry rain gear'],
      actionsHi: ['30 मिनट पहले निकलें', 'अंडरपास से बचें', 'बरसाती साथ रखें'], validHours: 12,
    },
  },
  {
    key: 'cyclone', label: 'Cyclone', labelHi: 'चक्रवात', emoji: '🌀', condition: 'storm',
    desc: 'RED alert — official warning overrides everything',
    params: { aqi: 72, uv: 1, precip: 40, rainProb: 95, wind: 95, gust: 130, wave: 6.5, temp: 25, humidity: 96, visibility: 0.8, pollen: 0 },
    warning: {
      severity: 'red', source: 'IMD', event: 'Cyclone',
      headline: 'Cyclone warning — very severe cyclonic storm approaching coast', headlineHi: 'चक्रवात चेतावनी — अति भीषण चक्रवाती तूफ़ान तट की ओर',
      body: 'Sustained winds 95 km/h gusting to 130 km/h; storm surge 1–1.5 m. Fishermen must not venture into sea. Move to designated shelters if in low-lying coastal areas.',
      bodyHi: 'हवा 95 किमी/घं, झोंके 130 किमी/घं; तूफ़ानी लहरें 1–1.5 मी। मछुआरे समुद्र में न जाएँ। निचले तटीय इलाकों से आश्रय स्थलों की ओर जाएँ।',
      actions: ['Do not go to sea', 'Move to shelter if coastal', 'Charge phone, store water'],
      actionsHi: ['समुद्र में न जाएँ', 'तटीय हैं तो आश्रय जाएँ', 'फ़ोन चार्ज, पानी भरें'], validHours: 36,
    },
  },
  { key: 'beach_day', label: 'Beach day', labelHi: 'समुद्र तट दिवस', emoji: '🏝️', condition: 'sunny', desc: 'Calm seas, UV 9 — beach persona shines', params: { aqi: 45, uv: 9, precip: 0, rainProb: 10, wind: 12, wave: 0.8, waterTemp: 28, temp: 31, humidity: 66, pollen: 2 } },
  {
    key: 'frost_night', label: 'Frost night', labelHi: 'पाले की रात', emoji: '❄️', condition: 'cold',
    desc: '4 °C — farmer gets frost-protection guidance',
    params: { aqi: 90, uv: 4, precip: 0, rainProb: 10, wind: 4, temp: 4, soil: 22, humidity: 78, visibility: 2.5, pollen: 1 },
    warning: {
      severity: 'yellow', source: 'IMD', event: 'Cold Wave',
      headline: 'Ground frost likely tonight in open fields', headlineHi: 'आज रात खुले खेतों में पाला पड़ने की संभावना',
      body: 'Minimum temperature 3–4 °C with calm winds and clear skies — classic radiative frost setup between 2–6 AM.',
      bodyHi: 'न्यूनतम तापमान 3–4 °C, शांत हवा और साफ़ आसमान — रात 2–6 बजे पाले की स्थिति।',
      actions: ['Light irrigation at dusk', 'Smoke/cover nurseries', 'Cover seedlings'],
      actionsHi: ['शाम को हल्की सिंचाई', 'नर्सरी में धुआँ/ढकाव', 'पौध ढकें'], validHours: 14,
    },
  },
];

export const DEMO_USERS: { user: UserProfile; cityKey: string; scenarioKey: ScenarioKey; label: string }[] = [
  {
    label: 'Ananya · Runner + Commuter · Pune', cityKey: 'pune', scenarioKey: 'clear',
    user: {
      id: 'ananya', name: 'Ananya', nameHi: 'अनन्या', personas: ['fitness', 'health', 'commuter'], conditions: ['asthma'],
      activities: [
        { type: 'run', label: 'Morning run · Pashan Lake', labelHi: 'सुबह की दौड़ · पाषाण झील', time: '06:30' },
        { type: 'commute', label: 'Commute to Hinjewadi', labelHi: 'हिंजेवाड़ी आवागमन', time: '09:00' },
        { type: 'yoga', label: 'Terrace yoga', labelHi: 'छत पर योग', time: '18:30' },
      ],
      locations: [{ type: 'home', label: 'Kothrud' }, { type: 'work', label: 'Hinjewadi Ph-2' }],
      city: 'pune', language: 'en', behaviorBias: { running_window: 0.9, aqi: 0.75 },
    },
  },
  {
    label: 'Ramesh · Farmer · Punjab', cityKey: 'chandigarh', scenarioKey: 'frost_night',
    user: {
      id: 'ramesh', name: 'Ramesh', nameHi: 'रमेश', personas: ['agriculture', 'commuter'], conditions: [],
      activities: [
        { type: 'farm_work', label: 'Wheat field — irrigation', labelHi: 'गेहूँ का खेत — सिंचाई', time: '06:00' },
        { type: 'commute', label: 'Mandi trip on bike', labelHi: 'बाइक से मंडी', time: '10:00' },
        { type: 'farm_work', label: 'Frost cover check', labelHi: 'पाला ढकाव जाँच', time: '21:00' },
      ],
      locations: [{ type: 'home', label: 'Kharar' }, { type: 'farm', label: 'Wheat farm · 4 acres' }],
      city: 'chandigarh', language: 'hi', behaviorBias: { farm_frost: 0.9, farm_irrigation: 0.8 },
    },
  },
  {
    label: 'Asha · Parent + Events · Mumbai', cityKey: 'mumbai', scenarioKey: 'rainy_commute',
    user: {
      id: 'asha', name: 'Asha', nameHi: 'आशा', personas: ['parent', 'health', 'events'], conditions: ['pollen_allergy'],
      activities: [
        { type: 'school_drop', label: 'School drop — Aarav', labelHi: 'स्कूल छोड़ना — आरव', time: '07:45' },
        { type: 'school_pickup', label: 'School pickup', labelHi: 'स्कूल से लाना', time: '15:30' },
        { type: 'event', label: 'Society mela (outdoor)', labelHi: 'सोसाइटी मेला (बाहर)', time: '19:00' },
      ],
      locations: [{ type: 'home', label: 'Andheri West' }, { type: 'school', label: 'Juhu' }],
      city: 'mumbai', language: 'en', behaviorBias: { school_commute: 0.85, event_weather: 0.7 },
    },
  },
];

export const CONDITIONS: Record<string, { label: string; labelHi: string }> = {
  asthma: { label: 'Asthma', labelHi: 'दमा' },
  pollen_allergy: { label: 'Pollen allergy', labelHi: 'पराग एलर्जी' },
  uv_sensitive: { label: 'UV sensitive', labelHi: 'UV संवेदनशील' },
  heat_sensitive: { label: 'Heat sensitive', labelHi: 'गर्मी संवेदनशील' },
};

// ---------------------------------------------------------------- helpers

export const clamp = (n: number, a = 0, b = 100) => Math.max(a, Math.min(b, n));
export const round1 = (n: number) => Math.round(n * 10) / 10;

export function levelFor(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  if (score >= 20) return 'Poor';
  return 'Avoid';
}
export const LEVEL_HI: Record<string, string> = {
  Excellent: 'उत्कृष्ट', Good: 'अच्छा', Fair: 'ठीक', Poor: 'खराब', Avoid: 'टालें',
};

export function scoreColor(score: number): string {
  if (score >= 80) return '#2E9E4A';
  if (score >= 60) return '#7CB342';
  if (score >= 40) return '#F2B100';
  if (score >= 20) return '#F57C00';
  return '#E53935';
}

export const SEVERITY_COLOR: Record<Severity, string> = {
  green: '#2E9E4A', yellow: '#F2B100', orange: '#F57C00', red: '#E53935',
};

export function aqiBand(aqi: number): { label: string; labelHi: string; color: string } {
  if (aqi <= 50) return { label: 'Good', labelHi: 'अच्छा', color: '#2E9E4A' };
  if (aqi <= 100) return { label: 'Satisfactory', labelHi: 'संतोषजनक', color: '#7CB342' };
  if (aqi <= 200) return { label: 'Moderate', labelHi: 'मध्यम', color: '#F2B100' };
  if (aqi <= 300) return { label: 'Poor', labelHi: 'खराब', color: '#F57C00' };
  if (aqi <= 400) return { label: 'Very Poor', labelHi: 'बहुत खराब', color: '#E53935' };
  return { label: 'Severe', labelHi: 'गंभीर', color: '#8E24AA' };
}

export function uvBand(uv: number): { label: string; labelHi: string; color: string } {
  if (uv <= 2) return { label: 'Low', labelHi: 'कम', color: '#2E9E4A' };
  if (uv <= 5) return { label: 'Moderate', labelHi: 'मध्यम', color: '#F2B100' };
  if (uv <= 7) return { label: 'High', labelHi: 'उच्च', color: '#F57C00' };
  if (uv <= 10) return { label: 'Very High', labelHi: 'बहुत उच्च', color: '#E53935' };
  return { label: 'Extreme', labelHi: 'अत्यधिक', color: '#8E24AA' };
}

export function fmtHour(h: number, lang: Lang = 'en'): string {
  const hh = ((h % 24) + 24) % 24;
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  if (lang === 'hi') {
    const suffix = hh < 4 ? 'रात' : hh < 12 ? 'सुबह' : hh < 17 ? 'दोपहर' : hh < 20 ? 'शाम' : 'रात';
    return `${suffix} ${h12}`;
  }
  return `${h12} ${hh < 12 ? 'AM' : 'PM'}`;
}
export function fmtTime(hhmm: string, lang: Lang = 'en'): string {
  const [h, m] = hhmm.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = String(m).padStart(2, '0');
  if (lang === 'hi') return `${h12}:${mm} ${h < 12 ? 'पूर्वाह्न' : 'अपराह्न'}`;
  return `${h12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
}
export function fmtWindow(startH: number, durH: number, lang: Lang = 'en'): string {
  const end = startH + durH;
  const f = (x: number) => {
    const h = Math.floor(x); const m = Math.round((x - h) * 60);
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')}`;
  };
  const ampm = (x: number) => (lang === 'hi' ? (x < 12 ? 'पूर्वाह्न' : 'अपराह्न') : x < 12 ? 'AM' : 'PM');
  return `${f(startH)}–${f(end)} ${ampm(end)}`;
}
export const timeToHour = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h + m / 60;
};
export function fmtHourMin(x: number, lang: Lang = 'en'): string {
  const h = Math.floor(x) % 24; const m = Math.round((x - Math.floor(x)) * 60);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const suffix = lang === 'hi' ? (h < 12 ? 'पूर्वाह्न' : 'अपराह्न') : h < 12 ? 'AM' : 'PM';
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export const L = (lang: Lang, en: string, hi: string) => (lang === 'hi' ? hi : en);

// ---------------------------------------------------------------- weather synthesis

export function resolveParams(s: ScenarioDef): WeatherParams {
  const p = s.params;
  const temp = p.temp ?? 26;
  const wind = p.wind ?? 10;
  const precip = p.precip ?? 0;
  const aqi = p.aqi ?? 60;
  return {
    temp,
    feelsLike: p.feelsLike ?? temp + (temp > 35 ? 3 : temp < 8 ? -2 : 0),
    humidity: p.humidity ?? 60, wind,
    gust: p.gust ?? Math.round(wind * 1.6),
    precip, rainProb: p.rainProb ?? precip * 4,
    visibility: p.visibility ?? (precip < 5 ? 10 : 3),
    uv: p.uv ?? 5, aqi, pm25: p.pm25 ?? round1(aqi * 0.6),
    wave: p.wave, waterTemp: p.waterTemp, soil: p.soil ?? 45,
    heatIndex: p.heatIndex ?? temp + (temp > 33 ? 3 : 0),
    pollen: p.pollen ?? 3, condition: s.condition,
  };
}

function conditionAt(s: ScenarioDef, h: number, rainProb: number): Condition {
  const night = h < 6 || h >= 19;
  if (s.condition === 'storm') return 'storm';
  if (s.condition === 'haze') return night ? 'night' : 'haze';
  if (s.condition === 'cold') return night ? 'night' : h < 10 ? 'fog' : 'cold';
  if (rainProb >= 55) return 'rain';
  if (rainProb >= 35) return 'cloudy';
  if (night) return 'night';
  if (s.condition === 'hot') return 'hot';
  if (s.condition === 'partly') return h < 11 ? 'partly' : 'sunny';
  return 'sunny';
}

export function buildHourly(s: ScenarioDef, p: WeatherParams, nowHour: number): HourPoint[] {
  const amp = s.key === 'heatwave' ? 6 : s.key === 'frost_night' ? 6 : s.key === 'cyclone' || s.key === 'rainy_commute' ? 2 : 4.5;
  const curve = (h: number) => Math.cos(((h - 15) / 24) * Math.PI * 2);
  const base = p.temp - amp * curve(nowHour);
  const out: HourPoint[] = [];
  for (let i = 0; i < 24; i++) {
    const h = (nowHour + i) % 24;
    const temp = Math.round(base + amp * curve(h));
    let rainProb = p.rainProb;
    if (s.key === 'rainy_commute') {
      const peak = (h >= 8 && h <= 10) || (h >= 17 && h <= 19);
      rainProb = peak ? 85 : h >= 11 && h <= 16 ? 45 : 30;
    } else if (s.key === 'clear' || s.key === 'beach_day') {
      rainProb = h >= 15 && h <= 18 ? p.rainProb + 10 : p.rainProb;
    } else if (s.key === 'cyclone') {
      rainProb = 95;
    }
    let aqi = p.aqi;
    if (s.key === 'aqi_spike') aqi = h >= 5 && h <= 9 ? 330 : h >= 14 && h <= 17 ? 240 : 300;
    else if (s.key !== 'cyclone') aqi = Math.round(p.aqi + (h >= 6 && h <= 9 ? 8 : h >= 14 && h <= 17 ? -6 : 0));
    const uv = h >= 6 && h <= 18 ? round1(p.uv * Math.pow(Math.max(0, Math.sin(((h - 6) / 12) * Math.PI)), 1.5)) : 0;
    const wind = Math.round(p.wind * (h >= 12 && h <= 17 ? 1.25 : 0.9));
    out.push({ hour: h, temp, rainProb: clamp(Math.round(rainProb)), aqi, uv, wind, condition: conditionAt(s, h, rainProb) });
  }
  return out;
}

const DAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_HI = ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'];

export function buildDaily(s: ScenarioDef, p: WeatherParams): DayPoint[] {
  const today = new Date();
  const seq: Partial<Record<ScenarioKey, number[]>> = {
    rainy_commute: [85, 70, 40, 20, 15], cyclone: [95, 90, 60, 30, 15],
    aqi_spike: [4, 6, 10, 30, 40], heatwave: [8, 5, 5, 20, 35], frost_night: [10, 10, 5, 5, 15],
  };
  const rains = seq[s.key] ?? [p.rainProb, p.rainProb + 8, p.rainProb + 20, p.rainProb + 5, p.rainProb];
  const tempDelta = s.key === 'heatwave' ? [0, 1, 1, -2, -4] : s.key === 'frost_night' ? [0, -1, 1, 2, 3] : [0, 0, -1, 1, 1];
  return rains.map((r, i) => {
    const d = new Date(today); d.setDate(today.getDate() + i);
    const hi = Math.round(p.temp + tempDelta[i] + (s.key === 'frost_night' ? 14 : 3));
    const lo = Math.round(p.temp + tempDelta[i] - (s.key === 'heatwave' ? 12 : s.key === 'frost_night' ? 0 : 6));
    const cond: Condition = r >= 55 ? 'rain' : r >= 35 ? 'cloudy' : s.key === 'aqi_spike' && i < 3 ? 'haze' : s.key === 'heatwave' && i < 3 ? 'hot' : 'sunny';
    return {
      label: i === 0 ? 'Today' : DAY_EN[d.getDay()],
      labelHi: i === 0 ? 'आज' : DAY_HI[d.getDay()],
      hi, lo, rainProb: clamp(Math.round(r)),
      condition: i === 0 && s.key === 'cyclone' ? 'storm' : cond,
    };
  });
}

// ---------------------------------------------------------------- impact models

interface Model {
  score: number; level: string; summary: string; factors: Factor[];
  bestWindow?: string; actions?: string[]; data?: Record<string, unknown>;
}

const F = (name: string, nameHi: string, value: string, impact: Factor['impact']): Factor => ({ name, nameHi, value, impact });

export function aqiModel(p: WeatherParams, user: UserProfile, lang: Lang): Model {
  const band = aqiBand(p.aqi);
  const sensitive = user.conditions.includes('asthma');
  const bands: [number, number, number, number][] = [
    [0, 50, 100, 85], [51, 100, 85, 65], [101, 200, 65, 40], [201, 300, 40, 20], [301, 400, 20, 5], [401, 500, 5, 0],
  ];
  const b = bands.find(([lo, hi]) => p.aqi >= lo && p.aqi <= hi) ?? bands[bands.length - 1];
  let score = Math.round(b[2] - ((p.aqi - b[0]) / (b[1] - b[0])) * (b[2] - b[3]));
  if (sensitive && p.aqi > 100) score = Math.round(score * 0.8);
  score = clamp(score);
  const summary =
    p.aqi > 200
      ? sensitive
        ? L(lang, `PM2.5 ${p.pm25} µg/m³. Asthma flag: keep inhaler close, skip outdoor exertion — indoor workout until air improves after 2 PM.`, `PM2.5 ${p.pm25} µg/m³। दमा: इनहेलर पास रखें, बाहर परिश्रम न करें — दोपहर 2 बजे तक अंदर व्यायाम।`)
        : L(lang, `PM2.5 ${p.pm25} µg/m³. Limit time outdoors; N95 recommended for commute.`, `PM2.5 ${p.pm25} µg/m³। बाहर कम रहें; आवागमन में N95 पहनें।`)
      : p.aqi > 100
        ? L(lang, `Moderate air — fine for most; sensitive groups shorten outdoor sessions.`, `मध्यम हवा — अधिकांश के लिए ठीक; संवेदनशील लोग बाहर कम समय बिताएँ।`)
        : p.aqi <= 50
          ? L(lang, `Rare clean air (PM2.5 ${p.pm25}). Great morning to open windows and exercise outside.`, `दुर्लभ स्वच्छ हवा (PM2.5 ${p.pm25})। खिड़कियाँ खोलें, बाहर व्यायाम करें।`)
          : L(lang, `Satisfactory. PM2.5 ${p.pm25} µg/m³ — no restrictions for outdoor activity.`, `संतोषजनक। PM2.5 ${p.pm25} µg/m³ — बाहरी गतिविधि पर कोई रोक नहीं।`);
  return {
    score, level: L(lang, band.label, band.labelHi), summary,
    factors: [
      F('PM2.5', 'PM2.5', `${p.pm25} µg/m³`, p.pm25 > 90 ? 'bad' : p.pm25 > 35 ? 'neutral' : 'good'),
      F('Wind dispersal', 'हवा फैलाव', `${p.wind} km/h`, p.wind >= 10 ? 'good' : 'bad'),
      F('Humidity', 'नमी', `${p.humidity}%`, p.humidity > 80 ? 'bad' : 'neutral'),
    ],
    data: { aqi: p.aqi, pm25: p.pm25, band: band.label, color: band.color },
  };
}

export function uvModel(p: WeatherParams, lang: Lang): Model {
  const band = uvBand(p.uv);
  const score = clamp(Math.round(100 - p.uv * 8.5));
  const summary =
    p.uv >= 8
      ? L(lang, `UV ${p.uv} — burns in ~15 min. SPF 50+, hat, seek shade 11 AM–3 PM.`, `UV ${p.uv} — 15 मिनट में जलन। SPF 50+, टोपी, 11–3 बजे छाया।`)
      : p.uv >= 6
        ? L(lang, `UV ${p.uv} — apply SPF 30+, reapply every 2 h if outdoors past 11 AM.`, `UV ${p.uv} — SPF 30+ लगाएँ, 11 बजे बाद हर 2 घंटे दोबारा।`)
        : p.uv >= 3
          ? L(lang, `UV ${p.uv} — moderate. Sunscreen for long exposure.`, `UV ${p.uv} — मध्यम। लंबे समय बाहर हों तो सनस्क्रीन।`)
          : L(lang, `UV ${p.uv} — low. No protection needed today.`, `UV ${p.uv} — कम। आज सुरक्षा की ज़रूरत नहीं।`);
  return {
    score, level: L(lang, band.label, band.labelHi), summary,
    factors: [F('UV index', 'UV सूचकांक', `${p.uv}`, p.uv > 7 ? 'bad' : p.uv > 5 ? 'neutral' : 'good'), F('Peak', 'चरम', '12–2 PM', 'neutral')],
    data: { uv: p.uv, band: band.label, color: band.color },
  };
}

function runScoreAt(pt: HourPoint, humidity: number): number {
  let pen = 0;
  pen += Math.max(0, Math.abs(pt.temp - 18) - 5) * 2.6;
  pen += Math.max(0, humidity - 70) * 0.45;
  pen += Math.max(0, pt.aqi - 100) * 0.28;
  pen += Math.max(0, pt.rainProb - 45) * 0.7;
  pen += Math.max(0, pt.wind - 25) * 1.2;
  pen += pt.uv > 7 ? 10 : 0;
  return clamp(Math.round(100 - pen));
}

export function runningModel(p: WeatherParams, hourly: HourPoint[], user: UserProfile, lang: Lang, cycle = false): Model {
  const now = hourly[0];
  const score = runScoreAt(now, p.humidity) - (user.conditions.includes('asthma') && p.aqi > 150 ? 15 : 0);
  let best = { start: 6, val: -1 };
  for (const pt of hourly) {
    if (pt.hour < 5 || pt.hour > 20) continue;
    const next = hourly.find((x) => x.hour === (pt.hour + 1) % 24) ?? pt;
    const v = (runScoreAt(pt, p.humidity) + runScoreAt(next, p.humidity)) / 2;
    if (v > best.val) best = { start: pt.hour, val: v };
  }
  const window = fmtWindow(best.start, 1.5, lang);
  const s = clamp(score);
  const lvl = levelFor(s);
  const act = cycle ? L(lang, 'ride', 'साइकिल') : L(lang, 'run', 'दौड़');
  const summary =
    s >= 60
      ? L(lang, `Good conditions for your ${act}. ${now.temp}°, AQI ${now.aqi}, ${now.rainProb}% rain. Best window ${window} (${Math.round(best.val)}/100).`, `${act} के लिए अच्छी स्थिति। ${now.temp}°, AQI ${now.aqi}, ${now.rainProb}% बारिश। सर्वोत्तम समय ${window} (${Math.round(best.val)}/100)।`)
      : s >= 40
        ? L(lang, `Manageable but not ideal — shorten to 30 min or shift to ${window}.`, `संभव पर आदर्श नहीं — 30 मिनट करें या ${window} पर करें।`)
        : L(lang, `Skip outdoor ${act} now (${lvl}). ${p.aqi > 150 ? 'Air quality' : p.rainProb > 60 ? 'Rain' : p.temp > 35 ? 'Heat' : 'Conditions'} is the blocker — indoor session or ${window}.`, `अभी बाहर ${act} न करें (${LEVEL_HI[lvl]})। ${p.aqi > 150 ? 'हवा' : p.rainProb > 60 ? 'बारिश' : p.temp > 35 ? 'गर्मी' : 'स्थिति'} बाधा है — अंदर व्यायाम या ${window}।`);
  return {
    score: s, level: L(lang, lvl, LEVEL_HI[lvl]), summary, bestWindow: window,
    factors: [
      F('Temperature', 'तापमान', `${now.temp}°C`, Math.abs(now.temp - 18) <= 6 ? 'good' : Math.abs(now.temp - 18) <= 12 ? 'neutral' : 'bad'),
      F('Air quality', 'वायु गुणवत्ता', `AQI ${now.aqi}`, now.aqi <= 100 ? 'good' : now.aqi <= 200 ? 'neutral' : 'bad'),
      F('Rain chance', 'बारिश', `${now.rainProb}%`, now.rainProb < 30 ? 'good' : now.rainProb < 60 ? 'neutral' : 'bad'),
      F('Humidity', 'नमी', `${p.humidity}%`, p.humidity < 70 ? 'good' : p.humidity < 85 ? 'neutral' : 'bad'),
    ],
    data: { bestWindowScore: Math.round(best.val), bestStart: best.start },
  };
}

export function commuteModel(p: WeatherParams, hourly: HourPoint[], atHour: number, lang: Lang, label: string): Model {
  const pt = hourly.find((h) => h.hour === Math.floor(atHour) % 24) ?? hourly[0];
  let pen = pt.rainProb * 0.55;
  pen += p.visibility < 5 ? (5 - p.visibility) * 8 : 0;
  pen += p.wind > 40 ? (p.wind - 40) * 0.6 : 0;
  const score = clamp(Math.round(100 - pen));
  const lvl = levelFor(score);
  const delay = score >= 60 ? 0 : score >= 40 ? 15 : score >= 20 ? 30 : 45;
  const at = fmtHourMin(atHour, lang);
  const summary =
    score >= 60 && p.visibility >= 3
      ? L(lang, `${label} at ${at}: dry roads, ${pt.rainProb}% rain, visibility ${p.visibility} km. No delay expected.`, `${label} ${at}: सूखी सड़कें, ${pt.rainProb}% बारिश, दृश्यता ${p.visibility} किमी। देरी नहीं।`)
      : score >= 60
        ? L(lang, `${label} at ${at}: roads dry but visibility only ${p.visibility} km. Low beams, add 10 min.`, `${label} ${at}: सड़कें सूखी पर दृश्यता केवल ${p.visibility} किमी। लो बीम, 10 मिनट अतिरिक्त।`)
        : L(lang, `${label} at ${at}: ${pt.rainProb}% rain, vis ${p.visibility} km${p.wind > 40 ? `, wind ${p.wind} km/h` : ''}. Leave ${delay} min early; avoid low-lying routes.`, `${label} ${at}: ${pt.rainProb}% बारिश, दृश्यता ${p.visibility} किमी। ${delay} मिनट पहले निकलें; निचले मार्ग टालें।`);
  return {
    score, level: L(lang, lvl, LEVEL_HI[lvl]), summary,
    factors: [
      F('Rain at departure', 'प्रस्थान पर बारिश', `${pt.rainProb}%`, pt.rainProb < 30 ? 'good' : pt.rainProb < 60 ? 'neutral' : 'bad'),
      F('Visibility', 'दृश्यता', `${p.visibility} km`, p.visibility >= 5 ? 'good' : p.visibility >= 2 ? 'neutral' : 'bad'),
      F('Wind', 'हवा', `${p.wind} km/h`, p.wind < 30 ? 'good' : p.wind < 50 ? 'neutral' : 'bad'),
    ],
    data: { delayMin: delay, rainAtDeparture: pt.rainProb },
  };
}

export function beachModel(p: WeatherParams, lang: Lang): Model {
  const wave = p.wave ?? 1.0;
  let pen = Math.max(0, wave - 1) * 28 + Math.max(0, p.wind - 20) * 1.4 + (p.uv > 8 ? 8 : 0) + (p.rainProb > 50 ? 25 : 0);
  const score = clamp(Math.round(100 - pen));
  const lvl = levelFor(score);
  const rip = wave > 2 || p.wind > 35 ? L(lang, 'High', 'उच्च') : wave > 1.2 ? L(lang, 'Moderate', 'मध्यम') : L(lang, 'Low', 'कम');
  const summary =
    score >= 60
      ? L(lang, `Calm sea — waves ${wave} m, water ${p.waterTemp ?? 27}°. Rip-current risk ${rip}. Swim near lifeguard flags; UV ${p.uv} so shade by 11.`, `शांत समुद्र — लहरें ${wave} मी, पानी ${p.waterTemp ?? 27}°। रिप-करंट जोखिम ${rip}। लाइफ़गार्ड झंडों के पास तैरें; UV ${p.uv}।`)
      : L(lang, `Do not enter the water. Waves ${wave} m, wind ${p.wind} km/h, rip-current risk ${rip}. INCOIS high-wave alert in force.`, `पानी में न जाएँ। लहरें ${wave} मी, हवा ${p.wind} किमी/घं, रिप-करंट ${rip}। INCOIS ऊँची लहर चेतावनी।`);
  return {
    score, level: L(lang, lvl, LEVEL_HI[lvl]), summary,
    factors: [
      F('Wave height', 'लहर ऊँचाई', `${wave} m`, wave <= 1.2 ? 'good' : wave <= 2 ? 'neutral' : 'bad'),
      F('Rip current', 'रिप करंट', rip, wave > 2 ? 'bad' : 'good'),
      F('Wind', 'हवा', `${p.wind} km/h`, p.wind < 25 ? 'good' : 'bad'),
    ],
    data: { wave, waterTemp: p.waterTemp, tide: L(lang, 'High tide 14:12 · Low 20:40', 'ज्वार 14:12 · भाटा 20:40') },
  };
}

export function frostModel(p: WeatherParams, lang: Lang): Model {
  const t = p.temp;
  const score = t <= 2 ? 8 : t <= 4 ? 22 : t <= 7 ? 55 : 92;
  const lvl = levelFor(score);
  const summary =
    score < 40
      ? L(lang, `Frost likely 2–6 AM (min ${t}°, calm wind ${p.wind} km/h, clear sky). Light-irrigate wheat at dusk; cover nursery beds; smoke at field edges.`, `रात 2–6 बजे पाला संभव (न्यूनतम ${t}°, शांत हवा ${p.wind} किमी/घं)। शाम को गेहूँ में हल्की सिंचाई; नर्सरी ढकें; खेत के किनारे धुआँ।`)
      : L(lang, `No frost risk tonight (min ${t}°). Normal night-time operations.`, `आज रात पाले का खतरा नहीं (न्यूनतम ${t}°)।`);
  return {
    score, level: L(lang, lvl, LEVEL_HI[lvl]), summary,
    factors: [F('Min temp', 'न्यूनतम तापमान', `${t}°C`, t > 7 ? 'good' : t > 4 ? 'neutral' : 'bad'), F('Wind', 'हवा', `${p.wind} km/h`, p.wind > 8 ? 'good' : 'bad'), F('Sky', 'आसमान', L(lang, 'Clear', 'साफ़'), 'bad')],
    actions: score < 40 ? [L(lang, 'Irrigate at dusk', 'शाम सिंचाई'), L(lang, 'Cover seedlings', 'पौध ढकें'), L(lang, 'Smoke field edges', 'किनारे धुआँ')] : undefined,
  };
}

export function irrigationModel(p: WeatherParams, daily: DayPoint[], lang: Lang): Model {
  const rainSoon = daily.slice(0, 3).some((d) => d.rainProb >= 60);
  const dry = p.soil < 30;
  const score = rainSoon ? 35 : dry ? 40 : 82;
  const summary = rainSoon
    ? L(lang, `Skip irrigation — ${daily[0].rainProb}% rain today, ${daily[1].rainProb}% tomorrow. Soil ${p.soil}% moisture will recover naturally.`, `सिंचाई टालें — आज ${daily[0].rainProb}% बारिश, कल ${daily[1].rainProb}%। मिट्टी ${p.soil}% नमी स्वतः बढ़ेगी।`)
    : dry
      ? L(lang, `Soil moisture ${p.soil}% — below 30% threshold and no rain for 3 days. Irrigate this evening (lower evaporation).`, `मिट्टी नमी ${p.soil}% — सीमा से कम, 3 दिन बारिश नहीं। आज शाम सिंचाई करें।`)
      : L(lang, `Soil moisture ${p.soil}% — adequate. Next check in 2 days.`, `मिट्टी नमी ${p.soil}% — पर्याप्त। 2 दिन बाद जाँचें।`);
  return {
    score, level: dry || rainSoon ? L(lang, 'Action', 'कार्रवाई') : L(lang, 'OK', 'ठीक'), summary,
    factors: [F('Soil moisture', 'मिट्टी नमी', `${p.soil}%`, p.soil >= 30 ? 'good' : 'bad'), F('Rain (3 d)', 'बारिश (3 दिन)', `${Math.max(...daily.slice(0, 3).map((d) => d.rainProb))}%`, rainSoon ? 'neutral' : 'good')],
  };
}

export function heatModel(p: WeatherParams, lang: Lang): Model {
  const hi = p.heatIndex;
  const score = hi >= 45 ? 8 : hi >= 40 ? 22 : hi >= 35 ? 50 : hi >= 30 ? 72 : 95;
  const lvl = levelFor(score);
  const summary =
    score < 40
      ? L(lang, `Feels like ${hi}°. Heat-stroke risk 12–4 PM. Hydrate 250 ml/hour, ORS if outdoors; check on elders and kids.`, `महसूस ${hi}°। दोपहर 12–4 लू का खतरा। हर घंटे 250 मि.ली. पानी, बाहर हों तो ORS; बुज़ुर्गों-बच्चों का ध्यान।`)
      : L(lang, `Feels like ${hi}° — comfortable. No heat precautions needed.`, `महसूस ${hi}° — आरामदायक। कोई सावधानी नहीं।`);
  return {
    score, level: L(lang, lvl, LEVEL_HI[lvl]), summary,
    factors: [F('Heat index', 'ताप सूचकांक', `${hi}°C`, hi < 33 ? 'good' : hi < 40 ? 'neutral' : 'bad'), F('Humidity', 'नमी', `${p.humidity}%`, 'neutral')],
  };
}

export function pollenModel(p: WeatherParams, user: UserProfile, lang: Lang): Model {
  const idx = p.pollen;
  const allergic = user.conditions.includes('pollen_allergy');
  let score = clamp(Math.round(100 - idx * 9 - (allergic && idx >= 5 ? 15 : 0)));
  const lvl = idx >= 7 ? L(lang, 'High', 'उच्च') : idx >= 4 ? L(lang, 'Moderate', 'मध्यम') : L(lang, 'Low', 'कम');
  const summary =
    idx >= 5
      ? L(lang, `Pollen ${lvl} (${idx}/10) — grass & parthenium peaking with dry wind. ${allergic ? 'Antihistamine before school run; keep car windows up.' : 'Sensitive people may sneeze more today.'}`, `पराग ${lvl} (${idx}/10) — सूखी हवा में घास व गाजर घास चरम पर। ${allergic ? 'स्कूल जाने से पहले एंटीहिस्टामिन; कार की खिड़कियाँ बंद।' : ''}`)
      : L(lang, `Pollen ${lvl} (${idx}/10)${p.rainProb > 50 ? ' — rain has washed it out' : ''}. Easy day for allergies.`, `पराग ${lvl} (${idx}/10)। एलर्जी के लिए आसान दिन।`);
  return { score, level: lvl, summary, factors: [F('Pollen index', 'पराग सूचकांक', `${idx}/10`, idx < 4 ? 'good' : idx < 7 ? 'neutral' : 'bad'), F('Wind', 'हवा', `${p.wind} km/h`, 'neutral')] };
}

export function eventModel(hourly: HourPoint[], atHour: number, _p: WeatherParams, lang: Lang, label: string): Model {
  const pt = hourly.find((h) => h.hour === Math.floor(atHour) % 24) ?? hourly[0];
  let pen = pt.rainProb * 0.7 + Math.max(0, pt.wind - 25) * 1.5 + Math.max(0, pt.temp - 33) * 3 + Math.max(0, 12 - pt.temp) * 2;
  const score = clamp(Math.round(100 - pen));
  const lvl = levelFor(score);
  const summary =
    score >= 60
      ? L(lang, `${label} at ${fmtHourMin(atHour, lang)} looks good: ${pt.temp}°, ${pt.rainProb}% rain, wind ${pt.wind} km/h. Dry window holds till late.`, `${label} ${fmtHourMin(atHour, lang)}: ${pt.temp}°, ${pt.rainProb}% बारिश, हवा ${pt.wind}। शाम तक सूखा।`)
      : L(lang, `${label} at ${fmtHourMin(atHour, lang)}: ${pt.rainProb}% rain chance, wind ${pt.wind} km/h. Arrange a covered fallback or start 1 h earlier.`, `${label} ${fmtHourMin(atHour, lang)}: ${pt.rainProb}% बारिश, हवा ${pt.wind}। ढका विकल्प रखें या 1 घंटा पहले शुरू करें।`);
  return {
    score, level: L(lang, lvl, LEVEL_HI[lvl]), summary,
    factors: [F('Rain during event', 'आयोजन में बारिश', `${pt.rainProb}%`, pt.rainProb < 30 ? 'good' : pt.rainProb < 60 ? 'neutral' : 'bad'), F('Wind', 'हवा', `${pt.wind} km/h`, pt.wind < 25 ? 'good' : 'bad'), F('Temp', 'तापमान', `${pt.temp}°`, 'neutral')],
  };
}

export function fogModel(p: WeatherParams, lang: Lang): Model {
  const v = p.visibility;
  const score = v >= 5 ? 90 : v >= 2 ? 50 : 15;
  const lvl = levelFor(score);
  const summary =
    v < 5
      ? L(lang, `Visibility ${v} km — dense ${p.condition === 'haze' ? 'smog' : 'fog'} till ~10 AM. Low beams, 2x following distance; expect train/flight delays.`, `दृश्यता ${v} किमी — सुबह 10 तक घना ${p.condition === 'haze' ? 'स्मॉग' : 'कोहरा'}। लो बीम, दोगुनी दूरी; ट्रेन/उड़ान देरी।`)
      : L(lang, `Visibility ${v} km — clear roads.`, `दृश्यता ${v} किमी — साफ़ सड़कें।`);
  return { score, level: L(lang, lvl, LEVEL_HI[lvl]), summary, factors: [F('Visibility', 'दृश्यता', `${v} km`, v >= 5 ? 'good' : v >= 2 ? 'neutral' : 'bad')] };
}

export function packingModel(p: WeatherParams, lang: Lang): Model {
  const items: string[] = [];
  if (p.rainProb > 40) items.push(L(lang, 'Umbrella / rain jacket', 'छाता / रेनकोट'));
  if (p.uv >= 6) items.push(L(lang, 'SPF 30+ & cap', 'SPF 30+ व टोपी'));
  if (p.temp >= 32) items.push(L(lang, 'Light cotton, 1 L water', 'हल्का सूती, 1 ली पानी'));
  if (p.temp <= 12) items.push(L(lang, 'Warm layer & gloves', 'गर्म परत व दस्ताने'));
  if (p.aqi > 150) items.push(L(lang, 'N95 mask', 'N95 मास्क'));
  if (!items.length) items.push(L(lang, 'Nothing special — easy day', 'कुछ खास नहीं — आसान दिन'));
  return { score: 70, level: L(lang, 'Ready', 'तैयार'), summary: items.join(' · '), factors: [], actions: items };
}

// ---------------------------------------------------------------- ranking

const W = { interest: 0.3, context: 0.2, urgency: 0.25, time: 0.1, location: 0.1, behavior: 0.05 };
const TIME_WINDOWS: Partial<Record<CardType, [number, number][]>> = {
  running_window: [[5, 9], [16, 20]], cycling_window: [[5, 9], [16, 20]],
  work_commute: [[7, 10], [17, 20]], school_commute: [[7, 9], [14, 16]],
  event_weather: [[15, 22]], farm_frost: [[17, 24], [0, 7]], farm_irrigation: [[5, 9], [16, 19]],
  uv: [[9, 16]], heat_stress: [[10, 17]], fog_alert: [[4, 10]], beach_safety: [[6, 18]], aqi: [[5, 10], [18, 23]],
};

function inWindow(type: CardType, hour: number): number {
  const w = TIME_WINDOWS[type];
  if (!w) return 0.6;
  return w.some(([a, b]) => hour >= a && hour < b) ? 1 : 0.45;
}

function rankCard(type: CardType, score: number | undefined, user: UserProfile, city: City, hour: number, pinned: boolean): { rank: number; breakdown: RankingBreakdown } {
  const primary = user.personas[0];
  const interest = PERSONA_INTERESTS[primary]?.includes(type) ? 1 : user.personas.some((p) => PERSONA_INTERESTS[p]?.includes(type)) ? 0.7 : 0.3;
  let context = 0.5;
  if ((type === 'aqi' || type === 'heat_stress') && user.conditions.includes('asthma')) context = 1;
  if (type === 'pollen' && user.conditions.includes('pollen_allergy')) context = 1;
  if ((type === 'running_window' || type === 'cycling_window') && user.activities.some((a) => a.type === 'run' || a.type === 'cycle')) context = 1;
  if (type === 'school_commute' && user.activities.some((a) => a.type.startsWith('school'))) context = 1;
  if (type === 'work_commute' && user.activities.some((a) => a.type === 'commute')) context = 0.9;
  if (type === 'event_weather' && user.activities.some((a) => a.type === 'event')) context = 1;
  if (type.startsWith('farm') && user.locations.some((l) => l.type === 'farm')) context = 1;
  const urgency = pinned ? 1 : score === undefined ? 0.25 : clamp((100 - score) / 100, 0, 1);
  const time = inWindow(type, hour);
  const location = type === 'beach_safety' || type === 'tide_info' || type === 'surf_conditions' ? (city.coastal ? 1 : 0.2) : type.startsWith('farm') ? (city.farm ? 1 : 0.6) : 0.8;
  const behavior = user.behaviorBias[type] ?? 0.5;
  const raw = W.interest * interest + W.context * context + W.urgency * urgency + W.time * time + W.location * location + W.behavior * behavior;
  return { rank: Math.round((pinned ? 2 + raw : raw) * 100), breakdown: { interest, context, urgency, time, location, behavior } };
}

// ---------------------------------------------------------------- homepage builder

export interface BuildOptions {
  user: UserProfile; cityKey: string; scenarioKey: ScenarioKey | 'auto'; hour: number; lang: Lang;
  live?: LiveWeather | null; // real observed data from the live source (Open-Meteo now)
}

/** Fill missing fields on a deserialized / legacy profile so buildHomepage never throws. */
export function normalizeUser(u: Partial<UserProfile> | undefined | null): UserProfile {
  return {
    id: u?.id ?? 'user',
    name: u?.name ?? 'User',
    nameHi: u?.nameHi ?? 'उपयोक्ता',
    personas: u?.personas?.length ? u.personas : ['health'],
    conditions: u?.conditions ?? [],
    activities: u?.activities ?? [],
    locations: u?.locations ?? [{ type: 'home', label: 'Home' }],
    city: u?.city ?? 'pune',
    language: u?.language ?? 'en',
    behaviorBias: u?.behaviorBias ?? {},
  };
}

export function buildHomepage(o: BuildOptions): Homepage {
  const city = CITIES.find((c) => c.key === o.cityKey) ?? CITIES[0];
  const useLive = o.scenarioKey === 'auto' && !!o.live;
  const scenario = useLive
    ? SCENARIOS.find((s) => s.key === 'clear')!
    : (SCENARIOS.find((s) => s.key === (o.scenarioKey === 'auto' ? city.defaultScenario : o.scenarioKey)) ?? SCENARIOS[0]);
  const p = useLive && o.live ? o.live.params : resolveParams(scenario);
  const hourly = useLive && o.live ? o.live.hourly : buildHourly(scenario, p, o.hour);
  const daily = useLive && o.live ? o.live.daily : buildDaily(scenario, p);
  const user = normalizeUser(o.user);
  const lang = o.lang;
  const now = new Date();
  const iso = (h: number) => new Date(now.getTime() + h * 3600_000).toISOString();

  const wants = (t: CardType) => user.personas.some((per) => PERSONA_INTERESTS[per].includes(t));
  const candidates: Card[] = [];
  let seq = 0;

  const push = (type: CardType, persona: PersonaKey, title: string, m: Model | null, opts: { phase?: Phase; source?: Source; why: string; severity?: Severity; pinned?: boolean; summary?: string; data?: Record<string, unknown>; actions?: string[]; confidence?: number }) => {
    const pinned = !!opts.pinned;
    const { rank, breakdown } = rankCard(type, m?.score, user, city, o.hour, pinned);
    const source = opts.source ?? (type === 'aqi' || type === 'pollen' ? 'CPCB' : type.startsWith('beach') || type === 'tide_info' || type === 'surf_conditions' ? 'INCOIS' : 'IMD');
    candidates.push({
      id: `${type}-${seq++}`, type, persona, title,
      summary: opts.summary ?? m?.summary ?? '',
      score: m?.score, level: m?.level, phase: opts.phase ?? 'derived', severity: opts.severity,
      bestWindow: m?.bestWindow, factors: m?.factors, actions: opts.actions ?? m?.actions,
      data: { ...(m?.data ?? {}), ...(opts.data ?? {}) },
      rank, priority: 0,
      explanation: { why: opts.why, source, confidence: opts.confidence ?? (pinned ? 0.99 : 0.92), validUntil: iso(pinned ? 12 : 1), ranking: breakdown },
      provenance: { source, issuedAt: iso(-0.1), validFrom: iso(-0.1), validUntil: iso(pinned ? 12 : 0.25), licence: source === 'Mausam Engine' ? 'Derived — MoES open data policy' : `${source} open data · GoI NDSAP` },
    });
  };

  // ---- official warnings
  const pinnedCards: Card[] = [];
  if (scenario.warning) {
    const w = scenario.warning;
    const isPinned = w.severity === 'orange' || w.severity === 'red';
    push('severe_warning', 'health', L(lang, `${w.source} · ${w.event} warning`, `${w.source} · ${w.event} चेतावनी`), null, {
      phase: 'official', source: w.source, severity: w.severity, pinned: isPinned,
      summary: L(lang, w.headline, w.headlineHi),
      data: { body: L(lang, w.body, w.bodyHi), event: w.event, validHours: w.validHours },
      actions: L(lang, w.actions.join('|'), w.actionsHi.join('|')).split('|'),
      why: L(lang, `Official ${w.severity.toUpperCase()} ${w.event} warning from ${w.source} for ${city.name} district — ${isPinned ? 'always pinned above personalization, never generated by AI' : 'shown as an official advisory (yellow warnings rank normally)'}.`, `${city.nameHi} ज़िले के लिए ${w.source} की आधिकारिक ${w.event} चेतावनी — ${isPinned ? 'हमेशा सबसे ऊपर, कभी AI से नहीं' : 'आधिकारिक सलाह के रूप में'}।`),
      confidence: 0.99,
    });
  }
  if (scenario.key === 'cyclone' && city.coastal) {
    push('severe_warning', 'beach', L(lang, 'INCOIS · High wave alert', 'INCOIS · ऊँची लहर चेतावनी'), null, {
      phase: 'official', source: 'INCOIS', severity: 'red', pinned: true,
      summary: L(lang, `Waves 6.5 m along ${city.state} coast — do not venture into sea`, `${city.state} तट पर 6.5 मी लहरें — समुद्र में न जाएँ`),
      data: { body: L(lang, 'High swell and storm surge expected for the next 36 h. Small boats must stay ashore; beaches closed.', 'अगले 36 घंटे ऊँची लहरें व तूफ़ानी उफान। छोटी नावें किनारे रहें; समुद्र तट बंद।') },
      actions: [L(lang, 'Stay off beaches', 'तट से दूर रहें'), L(lang, 'Secure boats', 'नावें सुरक्षित करें')],
      why: L(lang, 'Official INCOIS marine warning for a coastal district — pinned.', 'तटीय ज़िले के लिए आधिकारिक INCOIS चेतावनी — पिन।'),
      confidence: 0.99,
    });
    pinnedCards.push(candidates[candidates.length - 1]);
  }

  // ---- impact-model cards
  if (wants('aqi')) push('aqi', 'health', L(lang, 'Air quality', 'वायु गुणवत्ता'), aqiModel(p, user, lang), { why: L(lang, `Health persona + ${user.conditions.includes('asthma') ? 'asthma profile' : 'AQI interest'}; current AQI ${p.aqi} (${aqiBand(p.aqi).label}).`, `स्वास्थ्य पर्सोना + ${user.conditions.includes('asthma') ? 'दमा प्रोफ़ाइल' : 'AQI रुचि'}; AQI ${p.aqi}।`) });
  if (wants('running_window') || wants('cycling_window')) {
    const cyc = !wants('running_window');
    push(cyc ? 'cycling_window' : 'running_window', 'fitness', cyc ? L(lang, 'Best time to cycle', 'साइकिल का सही समय') : L(lang, 'Best time to run', 'दौड़ने का सही समय'), runningModel(p, hourly, user, lang, cyc), { why: L(lang, `Fitness persona with a saved ${cyc ? 'ride' : 'run'} at ${user.activities.find((a) => a.type === 'run' || a.type === 'cycle')?.time ?? '06:30'}; activity engine scored the next 24 h hourly.`, `फ़िटनेस पर्सोना; सहेजी गई गतिविधि; अगले 24 घंटे का स्कोर।`) });
  }
  if (wants('work_commute')) {
    const t = user.activities.find((a) => a.type === 'commute')?.time ?? '09:00';
    push('work_commute', 'commuter', L(lang, 'Commute risk', 'आवागमन जोखिम'), commuteModel(p, hourly, timeToHour(t), lang, L(lang, 'Office commute', 'ऑफ़िस सफ़र')), { why: L(lang, `Commuter persona; departure ${fmtTime(t, lang)} from ${user.locations[0]?.label ?? 'home'}; route weather evaluated at departure hour.`, `यात्री पर्सोना; प्रस्थान ${fmtTime(t, lang)}; मार्ग का मौसम।`) });
  }
  if (wants('school_commute')) {
    const drop = user.activities.find((a) => a.type === 'school_drop')?.time ?? '07:45';
    const pick = user.activities.find((a) => a.type === 'school_pickup')?.time ?? '15:30';
    const md = commuteModel(p, hourly, timeToHour(drop), lang, L(lang, 'School drop', 'स्कूल छोड़ना'));
    const mp = commuteModel(p, hourly, timeToHour(pick), lang, L(lang, 'Pickup', 'लाना'));
    const worse = mp.score < md.score ? mp : md;
    push('school_commute', 'parent', L(lang, 'School run', 'स्कूल आवागमन'), { ...worse, summary: `${md.summary} ${mp.score < md.score ? mp.summary : ''}`.trim(), data: { drop: md.score, pickup: mp.score } }, { why: L(lang, `Parent persona; school drop ${fmtTime(drop, lang)} & pickup ${fmtTime(pick, lang)} checked against hourly rain.`, `अभिभावक पर्सोना; स्कूल समय पर बारिश जाँच।`) });
  }
  if (wants('uv')) push('uv', 'health', L(lang, 'UV index', 'UV सूचकांक'), uvModel(p, lang), { why: L(lang, `UV ${p.uv} — WHO guidance thresholds; relevant to ${user.personas[0]} persona.`, `UV ${p.uv} — WHO दिशानिर्देश।`) });
  if (wants('beach_safety')) push('beach_safety', 'beach', L(lang, 'Beach safety', 'तट सुरक्षा'), beachModel(p, lang), { why: L(lang, `Beach persona in coastal ${city.name}; INCOIS wave & rip-current model.`, `तटीय ${city.nameHi} में समुद्र तट पर्सोना; INCOIS मॉडल।`), source: 'INCOIS' });
  if (wants('farm_frost')) push('farm_frost', 'agriculture', L(lang, 'Frost risk tonight', 'आज रात पाला'), frostModel(p, lang), { why: L(lang, `Farming persona with a saved wheat farm; radiative-frost model on IMD min-temp + wind + cloud.`, `खेती पर्सोना; IMD न्यूनतम तापमान पर पाला मॉडल।`) });
  if (wants('farm_irrigation')) push('farm_irrigation', 'agriculture', L(lang, 'Irrigation advice', 'सिंचाई सलाह'), irrigationModel(p, daily, lang), { why: L(lang, `Farming persona; soil moisture (ISRO SMAP proxy) vs 3-day rain forecast.`, `खेती पर्सोना; मिट्टी नमी बनाम 3-दिन बारिश।`), source: 'ISRO' });
  if (wants('heat_stress') && p.heatIndex >= 33) push('heat_stress', 'health', L(lang, 'Heat stress', 'गर्मी तनाव'), heatModel(p, lang), { why: L(lang, `Heat index ${p.heatIndex}° crossed the 33° threshold for the ${user.personas[0]} persona.`, `ताप सूचकांक ${p.heatIndex}° सीमा से ऊपर।`) });
  if (wants('pollen')) push('pollen', 'health', L(lang, 'Pollen', 'पराग'), pollenModel(p, user, lang), { why: L(lang, `${user.conditions.includes('pollen_allergy') ? 'Pollen-allergy profile' : 'Health persona'}; index derived from humidity, wind and season.`, `पराग एलर्जी प्रोफ़ाइल; नमी-हवा-मौसम से सूचकांक।`), source: 'Mausam Engine' });
  if (wants('event_weather')) {
    const ev = user.activities.find((a) => a.type === 'event');
    push('event_weather', 'events', L(lang, 'Event weather', 'आयोजन मौसम'), eventModel(hourly, timeToHour(ev?.time ?? '19:00'), p, lang, ev ? L(lang, ev.label, ev.labelHi) : L(lang, 'Your event', 'आपका आयोजन')), { why: L(lang, `Events persona with "${ev?.label ?? 'event'}" at ${fmtTime(ev?.time ?? '19:00', lang)}.`, `आयोजन पर्सोना; ${fmtTime(ev?.time ?? '19:00', lang)} पर आयोजन।`) });
  }
  if (wants('fog_alert') && p.visibility < 5) push('fog_alert', 'commuter', L(lang, p.condition === 'haze' ? 'Smog & visibility' : 'Fog alert', p.condition === 'haze' ? 'स्मॉग व दृश्यता' : 'कोहरा चेतावनी'), fogModel(p, lang), { why: L(lang, `Commuter persona; visibility ${p.visibility} km below 5 km threshold.`, `यात्री पर्सोना; दृश्यता ${p.visibility} किमी।`) });
  if (wants('rain_timeline') && !wants('work_commute') && !wants('school_commute')) {
    const nextRain = hourly.find((h) => h.rainProb >= 55);
    push('rain_timeline', 'commuter', L(lang, 'Rain timeline', 'बारिश समयरेखा'), { score: nextRain ? 45 : 90, level: nextRain ? L(lang, 'Rain ahead', 'बारिश आगे') : L(lang, 'Dry', 'सूखा'), summary: nextRain ? L(lang, `Rain from ${fmtHour(nextRain.hour, lang)} (${nextRain.rainProb}%). Dry until then.`, `${fmtHour(nextRain.hour, lang)} से बारिश (${nextRain.rainProb}%)।`) : L(lang, 'No rain in the next 24 h.', 'अगले 24 घंटे बारिश नहीं।'), factors: [] }, { why: L(lang, 'Rain interest from your personas.', 'आपके पर्सोना की बारिश रुचि।') });
  }
  if (wants('packing_advisor')) push('packing_advisor', 'travel', L(lang, 'Packing advisor', 'पैकिंग सलाह'), packingModel(p, lang), { why: L(lang, 'Travel persona; today\'s conditions summarised as a checklist.', 'यात्रा पर्सोना; चेकलिस्ट।'), phase: 'informational', source: 'Mausam Engine' });
  if (wants('travel_destination')) push('travel_destination', 'travel', L(lang, 'Destination: Goa', 'गंतव्य: गोवा'), { score: 78, level: L(lang, 'Good', 'अच्छा'), summary: L(lang, 'Goa this weekend: 31°, 20% rain, calm sea. No IMD advisories on NH-48.', 'इस सप्ताहांत गोवा: 31°, 20% बारिश, शांत समुद्र। NH-48 पर कोई चेतावनी नहीं।'), factors: [] }, { why: L(lang, 'Travel persona; saved trip.', 'यात्रा पर्सोना; सहेजी यात्रा।'), phase: 'informational' });
  if (wants('sunrise_sunset')) push('sunrise_sunset', 'events', L(lang, 'Golden hour', 'गोल्डन आवर'), { score: undefined as unknown as number, level: '', summary: L(lang, `Sunrise ${fmtTime(city.sunrise, lang)} · Sunset ${fmtTime(city.sunset, lang)}. Best light 45 min before sunset.`, `सूर्योदय ${fmtTime(city.sunrise, lang)} · सूर्यास्त ${fmtTime(city.sunset, lang)}।`), factors: [] }, { why: L(lang, 'Events persona — informational.', 'आयोजन पर्सोना — सूचनात्मक।'), phase: 'informational', source: 'IMD' });

  // ---- rank
  candidates.sort((a, b) => b.rank - a.rank);
  const seen = new Set<CardType>();
  const cards: Card[] = [];
  for (const c of candidates) {
    if (c.type !== 'severe_warning') { if (seen.has(c.type)) continue; seen.add(c.type); }
    cards.push(c);
  }
  cards.forEach((c, i) => (c.priority = i));
  const pinned = cards.filter((c) => c.type === 'severe_warning' && (c.severity === 'red' || c.severity === 'orange'));
  const rest = cards.filter((c) => !pinned.includes(c)).slice(0, 8);
  pinnedCards.push(...pinnedCards.filter((c) => !pinned.includes(c)));

  // ---- My Day
  const myDay: MyDayItem[] = user.activities.map((a) => {
    const h = timeToHour(a.time);
    const pt = hourly.find((x) => x.hour === Math.floor(h) % 24) ?? hourly[0];
    let score = 80;
    let note = '';
    let suggestion: string | undefined;
    switch (a.type) {
      case 'run': case 'cycle': case 'walk': case 'yoga': {
        score = runScoreAt(pt, p.humidity);
        note = L(lang, `${pt.temp}° · AQI ${pt.aqi} · ${pt.rainProb}% rain`, `${pt.temp}° · AQI ${pt.aqi} · ${pt.rainProb}% बारिश`);
        if (score < 60) { const rm = runningModel(p, hourly, user, lang); suggestion = L(lang, `Shift to ${rm.bestWindow}`, `${rm.bestWindow} पर करें`); }
        break;
      }
      case 'commute': case 'school_drop': case 'school_pickup': case 'travel': {
        const m = commuteModel(p, hourly, h, lang, '');
        score = m.score;
        note = L(lang, `${pt.rainProb}% rain · vis ${p.visibility} km`, `${pt.rainProb}% बारिश · दृश्यता ${p.visibility} किमी`);
        if (score < 60) suggestion = L(lang, `Leave ${(m.data?.delayMin as number) || 20} min early`, `${(m.data?.delayMin as number) || 20} मिनट पहले निकलें`);
        break;
      }
      case 'farm_work': {
        const fm = h >= 17 || h < 8 ? frostModel(p, lang) : irrigationModel(p, daily, lang);
        score = fm.score;
        note = L(lang, `${pt.temp}° · wind ${pt.wind} km/h · soil ${p.soil}%`, `${pt.temp}° · हवा ${pt.wind} · मिट्टी ${p.soil}%`);
        if (score < 60) suggestion = fm.actions?.[0] ?? L(lang, 'See farm card', 'खेती कार्ड देखें');
        break;
      }
      case 'event': {
        const em = eventModel(hourly, h, p, lang, '');
        score = em.score;
        note = L(lang, `${pt.temp}° · ${pt.rainProb}% rain · wind ${pt.wind}`, `${pt.temp}° · ${pt.rainProb}% बारिश · हवा ${pt.wind}`);
        if (score < 60) suggestion = L(lang, 'Book covered fallback', 'ढका विकल्प बुक करें');
        break;
      }
      case 'swim': {
        const bm = beachModel(p, lang);
        score = bm.score;
        note = L(lang, `waves ${p.wave ?? 1} m · UV ${pt.uv}`, `लहरें ${p.wave ?? 1} मी · UV ${pt.uv}`);
        break;
      }
    }
    if (scenario.warning && scenario.warning.severity === 'red') { score = Math.min(score, 15); suggestion = L(lang, 'Cancel — red alert in force', 'रद्द करें — रेड अलर्ट'); }
    return { activity: a, hour: h, score, status: score >= 60 ? 'go' : score >= 40 ? 'shift' : 'avoid', note, suggestion, point: pt };
  });

  // ---- brief (template NLG)
  const greet = o.hour < 12 ? L(lang, 'Good morning', 'सुप्रभात') : o.hour < 17 ? L(lang, 'Good afternoon', 'नमस्कार') : L(lang, 'Good evening', 'शुभ संध्या');
  const condWord: Record<Condition, [string, string]> = {
    sunny: ['clear', 'साफ़'], partly: ['partly cloudy', 'आंशिक बादल'], cloudy: ['cloudy', 'बादल'], rain: ['rainy', 'बरसाती'], storm: ['stormy', 'तूफ़ानी'], haze: ['hazy', 'धुंधला'], fog: ['foggy', 'कोहरा'], cold: ['cold & clear', 'ठंडा व साफ़'], hot: ['scorching', 'तपता'], night: ['clear', 'साफ़'],
  };
  const parts: string[] = [];
  parts.push(L(lang, `${greet}, ${user.name}. ${city.name} is ${p.temp}° and ${condWord[p.condition][0]}, AQI ${p.aqi} (${aqiBand(p.aqi).label}).`, `${greet}, ${user.nameHi}। ${city.nameHi} में ${p.temp}° और ${condWord[p.condition][1]}, AQI ${p.aqi} (${aqiBand(p.aqi).labelHi})।`));
  if (pinned.length) parts.push(L(lang, `⚠ ${pinned[0].summary}. Follow official guidance first.`, `⚠ ${pinned[0].summary}। पहले आधिकारिक निर्देश मानें।`));
  const top = rest.find((c) => c.score !== undefined && c.type !== 'severe_warning');
  if (top) parts.push(top.summary);
  const md = myDay.find((m) => m.status !== 'go');
  if (md) parts.push(L(lang, `Heads-up: ${md.activity.label} at ${fmtTime(md.activity.time, lang)} — ${md.suggestion ?? 'conditions are marginal'}.`, `ध्यान दें: ${md.activity.labelHi} ${fmtTime(md.activity.time, lang)} — ${md.suggestion ?? 'स्थिति सीमांत है'}।`));
  else if (myDay.length) parts.push(L(lang, `All ${myDay.length} planned activities look good today.`, `आज की सभी ${myDay.length} गतिविधियाँ ठीक दिख रही हैं।`));

  const freshnessMin = useLive && o.live ? Math.max(0, Math.round((now.getTime() - new Date(o.live.fetchedAt).getTime()) / 60000)) : 6;
  const freshness = useLive
    ? (freshnessMin <= 1 ? L(lang, 'just now', 'अभी') : L(lang, `${freshnessMin} min ago`, `${freshnessMin} मिनट पहले`))
    : L(lang, '6 min ago', '6 मिनट पहले');

  return {
    user, city, scenario, params: p, hour: o.hour, pinned, cards: rest, hourly, daily,
    brief: parts.join(' '), myDay,
    freshness,
    providers: [

      { name: 'IMD', status: 'ok', latencyMs: 212 },
      { name: 'CPCB', status: scenario.key === 'aqi_spike' ? 'degraded' : 'ok', latencyMs: scenario.key === 'aqi_spike' ? 1840 : 340 },
      { name: 'INCOIS', status: 'ok', latencyMs: 405 },
      { name: 'Open-Meteo', status: 'ok', latencyMs: 98 },
    ],
  };
}

// ---------------------------------------------------------------- Ask Mausam (template-first)

export interface AskAnswer { text: string; source: string; chips?: string[]; }

export function answerQuestion(q: string, hp: Homepage, lang: Lang): AskAnswer {
  const s = q.toLowerCase();
  const p = hp.params;
  const src = (x: string) => L(lang, `Answered from ${x} · template, not free-form AI`, `${x} डेटा से उत्तर · टेम्पलेट, AI अनुमान नहीं`);
  const evening = hp.hourly.find((h) => h.hour === 18) ?? hp.hourly[0];
  if (/run|jog|cycle|ride|walk|दौड़|साइकिल|टहल/.test(s)) {
    const m = runningModel(p, hp.hourly, hp.user, lang);
    const eve = runScoreAt(evening, p.humidity);
    return {
      text: L(lang, `Right now scores ${m.score}/100 (${m.level}). 6 PM scores ${eve}/100. Your best 90-minute window is ${m.bestWindow}. ${m.score < 40 ? 'Main blocker: ' + m.factors.find((f) => f.impact === 'bad')?.name.toLowerCase() + '.' : ''}`, `अभी ${m.score}/100 (${m.level})। शाम 6 बजे ${eve}/100। सर्वोत्तम समय ${m.bestWindow}।`),
      source: src('IMD hourly + CPCB AQI'),
      chips: [m.bestWindow ?? ''],
    };
  }
  if (/rain|umbrella|pickup|school|बारिश|छाता|स्कूल/.test(s)) {
    const pick = hp.hourly.find((h) => h.hour === 15) ?? hp.hourly[0];
    const next = hp.hourly.find((h) => h.rainProb >= 55);
    return {
      text: L(lang, `${pick.rainProb}% rain chance around 3:30 PM pickup${next ? `; first likely rain from ${fmtHour(next.hour)} (${next.rainProb}%)` : '; no rain expected in 24 h'}. ${pick.rainProb > 50 ? 'Carry an umbrella and leave 15 min early.' : 'Umbrella optional.'}`, `दोपहर 3:30 पर ${pick.rainProb}% बारिश की संभावना${next ? `; पहली बारिश ${fmtHour(next.hour, 'hi')} से` : '; 24 घंटे बारिश नहीं'}।`),
      source: src('IMD nowcast'),
    };
  }
  if (/swim|beach|sea|surf|तैर|समुद्र/.test(s)) {
    if (!hp.city.coastal) return { text: L(lang, `${hp.city.name} isn't coastal — nearest INCOIS station is 150+ km away. Save a beach location to get tide & rip-current cards.`, `${hp.city.nameHi} तटीय नहीं है। ज्वार कार्ड के लिए समुद्र तट स्थान सहेजें।`), source: src('INCOIS') };
    const m = beachModel(p, lang);
    return { text: `${m.summary} (${m.score}/100)`, source: src('INCOIS marine') };
  }
  if (/irrigat|water|crop|frost|farm|सिंचाई|पाला|फसल/.test(s)) {
    const im = irrigationModel(p, hp.daily, lang);
    const fm = frostModel(p, lang);
    return { text: `${im.summary} ${fm.score < 40 ? fm.summary : ''}`.trim(), source: src('IMD agromet + ISRO soil moisture') };
  }
  if (/wear|pack|carry|पहन|पैक/.test(s)) {
    return { text: packingModel(p, lang).summary, source: src('IMD + CPCB') };
  }
  if (/aqi|air|mask|pollution|हवा|मास्क|प्रदूषण/.test(s)) {
    const m = aqiModel(p, hp.user, lang);
    return { text: `AQI ${p.aqi} — ${m.level}. ${m.summary}`, source: src('CPCB CAAQMS') };
  }
  if (/hot|heat|temp|गर्म|तापमान/.test(s)) {
    return { text: L(lang, `${p.temp}° now, feels like ${p.feelsLike}°. Today ${hp.daily[0].lo}°–${hp.daily[0].hi}°. ${p.heatIndex >= 40 ? 'Heat-stress risk 12–4 PM — stay indoors.' : 'No heat precautions needed.'}`, `अभी ${p.temp}°, महसूस ${p.feelsLike}°। आज ${hp.daily[0].lo}°–${hp.daily[0].hi}°।`), source: src('IMD') };
  }
  return {
    text: L(lang, `I only answer from official IMD / CPCB / INCOIS data for ${hp.city.name}. Try one of the questions below.`, `मैं केवल ${hp.city.nameHi} के आधिकारिक IMD / CPCB / INCOIS डेटा से उत्तर देता हूँ। नीचे के प्रश्न आज़माएँ।`),
    source: src('Mausam Engine'),
  };
}

export const SUGGESTED_QUESTIONS: Record<Lang, string[]> = {
  en: ['Can I run this evening?', 'Will it rain at school pickup?', 'Is it safe to swim today?', 'Should I irrigate today?', 'What should I carry?', 'Do I need a mask?'],
  hi: ['क्या शाम को दौड़ सकती हूँ?', 'स्कूल छुट्टी पर बारिश होगी?', 'आज तैरना सुरक्षित है?', 'आज सिंचाई करूँ?', 'क्या साथ रखूँ?', 'मास्क चाहिए?'],
};