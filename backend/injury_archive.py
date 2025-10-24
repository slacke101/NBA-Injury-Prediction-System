#!/usr/bin/env python
"""Archive daily NBA injury report to backend/cache/injury_archive.json.
Run manually or via scheduler/GitHub Action.
"""

import json
import datetime as _dt
from pathlib import Path
import httpx

NBA_STATS_HEADERS = {
    "User-Agent": "SportsOnCourts Bot",
    "Referer": "https://stats.nba.com/",
    "Origin": "https://stats.nba.com",
}

CACHE_DIR = (Path(__file__).parent / "cache").resolve()
CACHE_DIR.mkdir(exist_ok=True)
ARCHIVE_FILE = CACHE_DIR / "injury_archive.json"


def main():
    today = _dt.date.today().isoformat()

    try:
        resp = httpx.get(
            "https://site.web.api.digital.nba.com/stats/injuryreport",
            headers=NBA_STATS_HEADERS,
            timeout=30,
        )
        resp.raise_for_status()
    except Exception as e:
        print("Failed to fetch injury report:", e)
        return

    payload = resp.json()
    headers = payload["resultSets"][0]["headers"]
    rows = payload["resultSets"][0]["rowSet"]

    entries = [dict(zip(headers, row)) | {"ARCHIVE_DATE": today} for row in rows]

    existing: list = []
    if ARCHIVE_FILE.exists():
        try:
            existing = json.loads(ARCHIVE_FILE.read_text())
        except Exception:
            existing = []

    existing.extend(entries)
    ARCHIVE_FILE.write_text(json.dumps(existing, indent=2))
    print(f"Archived {len(entries)} injury rows for {today} → {ARCHIVE_FILE}")


if __name__ == "__main__":
    main()
