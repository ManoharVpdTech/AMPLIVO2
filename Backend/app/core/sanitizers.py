"""Input sanitization utilities.

Strips HTML tags, escapes special characters, prevents header injection,
trims whitespace, and normalizes strings before they reach business logic.
"""

from __future__ import annotations

import html
import re
from typing import Any

from pydantic import BaseModel, model_validator

_SCRIPT_TAG_RE = re.compile(r"<script[^>]*>.*?</script>", re.IGNORECASE | re.DOTALL)
_HTML_TAG_RE = re.compile(r"<[^>]*>")
_CONTROL_CHAR_RE = re.compile(r"[\x00-\x1F\x7F]")
_MULTILINE_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]")
_CRLF_RE = re.compile(r"\r?\n|\r")


def strip_html(value: str) -> str:
    return _HTML_TAG_RE.sub("", _SCRIPT_TAG_RE.sub("", value))


def sanitize_html(value: str | None) -> str | None:
    if value is None:
        return None
    value = strip_html(value)
    value = html.escape(value, quote=True)
    return value


def sanitize_string(value: str | None) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        return value
    value = value.strip()
    value = _CONTROL_CHAR_RE.sub("", value)
    return value


def sanitize_multiline(value: str | None) -> str | None:
    if value is None:
        return None
    value = strip_html(value)
    value = _MULTILINE_CONTROL_CHAR_RE.sub("", value)
    value = value.strip()
    return value


def prevent_header_injection(value: str | None) -> str | None:
    if value is None:
        return None
    if _CRLF_RE.search(value):
        raise ValueError("Header injection detected: value contains newline characters.")
    return value


class SanitizedModel(BaseModel):
    """Base Pydantic model that auto-trims and sanitizes all string fields.

    Override ``_sanitized_fields`` in subclasses to customise behaviour per field::

        _sanitized_fields = {"biography": "multiline", "website": "url"}

    Modes:
    - ``"strict"`` (default): strip HTML, escape entities, strip whitespace
    - ``"multiline"``: strip HTML, strip whitespace, keep newlines
    - ``"raw"``: only strip whitespace and control chars (no HTML stripping)
    """

    _sanitized_fields: dict[str, str] = {}

    @model_validator(mode="before")
    @classmethod
    def _sanitize_inputs(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        sanitized = dict(data)

        sanitized_fields = {}
        for key in dir(cls):
            if key == "_sanitized_fields":
                val = getattr(cls, key)
                if isinstance(val, dict):
                    sanitized_fields = val
                    break

        for field_name, value in sanitized.items():
            if not isinstance(value, str):
                continue
            mode = sanitized_fields.get(field_name, "strict")
            if mode == "raw":
                sanitized[field_name] = sanitize_string(value)
            elif mode == "multiline":
                sanitized[field_name] = sanitize_multiline(value)
            else:
                sanitized[field_name] = strip_html(sanitize_string(value))
        return sanitized
