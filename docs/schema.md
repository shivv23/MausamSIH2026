# Core database schema (PostgreSQL + PostGIS)

Mapped from the definitive blueprint's PART SIX. Tables are created via Alembic
migrations in the SIH build; listed here as the canonical contract.

## Tables

- `users` — id, firebase_uid, display_name, email, phone, language, timezone, units, onboarding_completed, last_active_at
- `user_personas` — user_id, persona_type (multi-select with primary flag)
- `user_health_profiles` — user_id, condition (asthma, pollen_allergy, uv_sensitive, heat_sensitive), severity
- `user_locations` — location_type (home/work/school/farm), lat/lon PostGIS geography point, district, state
- `user_activities` — activity_type, preferred time windows/days, weather_sensitivity JSONB
- `user_commutes` — origin/destination, departure windows, mode, route_polyline (PostGIS LINESTRING), days
- `user_notification_settings` — per-category toggles, briefing time, quiet hours
- `weather_warnings` — provider, severity (green/yellow/orange/red), event_type, headline + translations, effective/expires, affected_area (PostGIS MultiPolygon, GIST-indexed), certainty, urgency
- `weather_cache` — geohash + data_type PK, weather_data JSONB, provider, expires_at
- `card_interactions` — user_id, card_type, interaction (view/tap/expand/dismiss/share), position, time_spent_ms
- `notification_log`, `user_feedback` (helpful/not_helpful/inaccurate/report with weather snapshot), `provider_status` (health, latency, consecutive failures)

Time-series observations are partitioned by month (or TimescaleDB). Raw provider
payloads stored as JSONB for audit.