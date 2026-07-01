"""Schéma JSON du contrat P3-A (docs/P3A-metadata-schema.md) — pour validation jsonschema."""

CONTRACT_SCHEMA = {
    "type": "object",
    "required": [
        "video", "language", "duration_sec", "transcript", "segments",
        "translation", "summary", "chapters", "keywords", "generated_at",
    ],
    "properties": {
        "video": {"type": "string"},
        "language": {"type": "string"},
        "duration_sec": {"type": "number"},
        "transcript": {"type": "string"},
        "segments": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["start", "end", "text"],
                "properties": {
                    "start": {"type": "number"},
                    "end": {"type": "number"},
                    "text": {"type": "string"},
                },
            },
        },
        "translation": {
            "type": "object",
            "required": ["lang", "text"],
            "properties": {"lang": {"type": "string"}, "text": {"type": "string"}},
        },
        "summary": {"type": "string"},
        "chapters": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["title", "start"],
                "properties": {"title": {"type": "string"}, "start": {"type": "number"}},
            },
        },
        "keywords": {"type": "array", "items": {"type": "string"}},
        "generated_at": {"type": "string"},
    },
}

SAMPLE = {
    "video": "demo.mp4",
    "language": "fr",
    "duration_sec": 12.3,
    "transcript": "Bonjour et bienvenue.",
    "segments": [{"start": 0.0, "end": 4.2, "text": "Bonjour et bienvenue."}],
    "translation": {"lang": "en", "text": "Hello and welcome."},
    "summary": "Une courte démonstration.",
    "chapters": [{"title": "Introduction", "start": 0.0}],
    "keywords": ["demo", "bienvenue"],
    "generated_at": "2026-06-30T10:00:00Z",
}
