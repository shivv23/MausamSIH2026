# Licensing & Data Provenance

## Guiding principle

The demo and MVP are **mock-first**: the provider abstraction means a live
IMD/CPCB/INCOIS outage or licensing surprise never blocks development, tests,
CI, or the demo. Real adapters are plugged into the same interface.

## Sources

| Source | Type | Purpose | Status |
|---|---|---|---|
| IMD (mausam.imd.gov.in) | Current/forecast/warnings, radar, marine, agromet | Authoritative backbone | Mock in dev; live adapter in SIH |
| CPCB (airquality.cpcb.gov.in) | AQI | Air quality bands + health | Mock in dev |
| INCOIS (incois.gov.in OSF) | Ocean state (tides/waves/SST) | Beach/marine/surf | Mock in dev |
| ISRO Bhuvan (bhuvan.nrsc.gov.in) | Soil moisture, geospatial | Agriculture | Mock in dev |
| Open-Meteo (open-meteo.com) | Pollen/UV/AQI fallback | Secondary + gap fill | Available |
| Crowdsource | Community reports + phone sensors | Micro-climate moat | Design |

## Verification during SIH

MOES/IMD open-data licensing and terms of use are formally confirmed during
SIH week for both the event and post-SIH use. The architecture is
license-agnostic (provider abstraction + mocks) so this never blocks delivery.

## Provenance on data & cards

Every payload carries `{source, issued_at, valid_from, valid_until, licence}`
and every card carries `{why_shown, source, confidence}`. Raw provider payloads
are retained (JSONB, audit-linked) via `raw_payload_ref`.