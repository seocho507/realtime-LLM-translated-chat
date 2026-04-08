from __future__ import annotations

from dataclasses import asdict, is_dataclass
from typing import Any


def to_payload(event_type: str, **fields: Any) -> dict[str, Any]:
    payload = {"t": event_type}
    for key, value in fields.items():
        if value is None:
            continue
        if is_dataclass(value):
            payload[key] = asdict(value)
        else:
            payload[key] = value
    return payload
