# API Contract — v1

Base URL: `http://localhost:8000/api/v1`

Every card response embeds provenance `{source, issued_at, valid_from, valid_until, licence}`
and an explanation block `{why_shown, source, confidence, valid_until}` — a core
"trust-through-transparency" requirement.

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Service health + version |
| GET | `/api/v1/homepage/cards` | Ranked personalized homepage cards |
| GET | `/api/v1/homepage/scenarios` | List mock demo scenarios |

## GET /api/v1/homepage/cards

Query params:
- `user_id` (required) — user (demo personas: `ananya`, `ramesh`, `asha`)
- `city` (default `pune`) — city anchor (imd anchor names: `pune`, `delhi`, `mumbai`, `chennai`, `kochi`, `chandigarh`, `kolkata`, `bengaluru`)
- `scenario` (optional) — override mock weather (`clear`, `aqi_spike`, `heatwave`, `rainy_commute`, `cyclone`, `beach_day`, `frost_night`, `clean_air_morning`)

### Example

```http
GET /api/v1/homepage/cards?user_id=ananya&city=pune
```

```jsonc
{
  "user_id": "ananya",
  "city": "Pune",
  "personas": ["fitness", "health", "commuter"],
  "generated_at": "...",
  "metadata": {
    "dataFreshness": "6 min ago",
    "providerStatus": [{"provider": "mock", "status": "ok"}]
  },
  "cards": [
    {
      "id": "uv-...",
      "type": "uv",
      "title": "UV Index",
      "summary": "UV 6.0 — apply SPF 30+, reapply every 2h...",
      "priority": 0,
      "phase": "derived",
      "data": {"uv": 6.0, "level": "Good"},
      "explanation": {"why_shown": "UV 6.0 — WHO guidance", "source": "mock", "confidence": 0.92},
      "provenance": {"source": "mock", "issued_at": "...", "licence": "..."}
    }
    // ... more ranked cards
  ]
}
```

## Ranking formula

```
Score = w1·Interest + w2·Context + w3·Urgency + w4·Time + w5·Location + w6·Behavior
```

Official Orange/Red IMD warnings are pinned above any personalization score.

## Response schema

See `backend/app/models/schemas.py` for the canonical Pydantic models.