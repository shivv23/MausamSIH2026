"""Provider abstraction.

Every data source (IMD, CPBP, INCOIS, ISRO, Open-Meteo, mocks, crowdsource)
implements the transport + parsing here and returns the canonical
``WeatherData``/``Provenance`` shape. The aggregator only talks to these
interfaces, so replacing a provider = replacing an adapter, never the app.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from app.models.schemas import GeoPoint, ProviderName, WeatherData


class BaseProvider(ABC):
    name: ProviderName
    supported_types: tuple[str, ...] = ("current", "hourly", "daily")

    @abstractmethod
    async def fetch(self, location: GeoPoint, data_type: str) -> WeatherData:
        raise NotImplementedError


class ProviderError(Exception):
    """Raised when a provider cannot serve data (down, banned, no coverage)."""