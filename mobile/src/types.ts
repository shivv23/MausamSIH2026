// Shared types mirroring the FastAPI canonical models (app/models/schemas.py).

export type CardType =
  | 'severe_warning'
  | 'my_day'
  | 'mausam_brief'
  | 'aqi'
  | 'uv'
  | 'pollen'
  | 'humidity'
  | 'running_window'
  | 'cycling_window'
  | 'outdoor_comfort'
  | 'school_commute'
  | 'work_commute'
  | 'rain_timeline'
  | 'fog_alert'
  | 'farm_irrigation'
  | 'farm_frost'
  | 'farm_planting'
  | 'beach_safety'
  | 'tide_info'
  | 'surf_conditions'
  | 'event_weather'
  | 'travel_destination'
  | 'packing_advisor'
  | 'sunrise_sunset';

export type AlertPhase = 'official' | 'derived' | 'informational';

export interface Provenance {
  source: string;
  issued_at: string;
  valid_from: string;
  valid_until: string;
  licence: string;
}

export interface CardExplanation {
  why_shown: string;
  source: string;
  confidence: number;
  valid_until: string;
}

export interface HomepageCard {
  id: string;
  type: CardType;
  title: string;
  summary: string;
  priority: number;
  phase?: AlertPhase;
  data: Record<string, unknown>;
  explanation: CardExplanation;
  provenance: Provenance;
}

export interface HomepageResponse {
  user_id: string;
  city?: string;
  personas: string[];
  generated_at: string;
  metadata: {
    dataFreshness?: string;
    providerStatus?: Array<{ provider: string; status: string }>;
  };
  cards: HomepageCard[];
}

export interface UserProfile {
  user_id: string;
  personas: string[];
  language: string;
  city?: string;
}

// Ask Mausam / My Day / activities.

export type AskIntent =
  | 'should_i_run'
  | 'should_i_travel'
  | 'should_i_irrigate'
  | 'beach_safety'
  | 'school_commute'
  | 'outdoor_event'
  | 'frost_risk'
  | 'general_brief';

export interface AskResponse {
  intent: AskIntent;
  answer: string;
  verbatim?: boolean;
  why: string[];
  score?: number;
  level?: string;
  source: string;
}

export interface ActivityWindow {
  activity: string;
  start: string;
  end: string;
  score: number;
  level: string;
  summary: string;
}

export interface MyDayResponse {
  user_id: string;
  date: string;
  city?: string;
  summary: string;
  best_window: string;
  slots: ActivityWindow[];
}

export interface Activity {
  id: string;
  type: string;
  label: string;
  days: number[];
  preferred_start?: string;
  preferred_end?: string;
}

// Persona catalog used by onboarding.
export interface PersonaOption {
  key: string;
  label: string;
  icon: string;
  color: string;
  description: string;
}

export const PERSONAS: PersonaOption[] = [
  { key: 'health', label: 'Health', icon: '🫁', color: '#2E7D32', description: 'AQI, pollen, UV, heat' },
  { key: 'fitness', label: 'Fitness', icon: '🏃', color: '#F57C00', description: 'Best time to run / cycle' },
  { key: 'beach', label: 'Beach & Surf', icon: '🏖️', color: '#1565C0', description: 'Tides, waves, safety' },
  { key: 'travel', label: 'Travel', icon: '✈️', color: '#6A1B9A', description: 'Destination advisories' },
  { key: 'parent', label: 'Parent & Family', icon: '👨‍👩‍👧', color: '#C2185B', description: 'School commute, rain' },
  { key: 'agriculture', label: 'Farming', icon: '🌾', color: '#00695C', description: 'Irrigation, frost, planting' },
  { key: 'commuter', label: 'Commuter', icon: '🚗', color: '#455A64', description: 'Route weather, fog, storm' },
  { key: 'events', label: 'Events', icon: '🎉', color: '#E65100', description: 'Outdoor event windows' },
];

// Activity types users can add to plan their day.
export interface ActivityTypeOption {
  key: string;
  label: string;
  icon: string;
}

export const ACTIVITY_TYPES: ActivityTypeOption[] = [
  { key: 'run', label: 'Run', icon: '🏃' },
  { key: 'cycle', label: 'Cycle', icon: '🚴' },
  { key: 'outdoor_gym', label: 'Outdoor Gym', icon: '🏋️' },
  { key: 'commute', label: 'Commute', icon: '🚗' },
  { key: 'school', label: 'School Drop', icon: '🎒' },
  { key: 'beach', label: 'Beach', icon: '🏖️' },
  { key: 'farm_irrigation', label: 'Irrigation', icon: '💧' },
  { key: 'event', label: 'Outdoor Event', icon: '🎉' },
];