from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from nba_api.stats.static import teams
from nba_api.stats.endpoints import (
    playercareerstats,
    commonplayerinfo,
    leaguedashplayerstats,
)

from nba_api.live.nba.endpoints import scoreboard as live_scoreboard
from typing import Optional, List
import random
from datetime import datetime, timedelta, timezone
import httpx
import json

# Path setup for disk cache
from pathlib import Path

CACHE_DIR = (Path(__file__).parent / "cache").resolve()
CACHE_DIR.mkdir(exist_ok=True)

# ---------------- Helper to determine current NBA season string ----------------


def current_season() -> str:
    """Return current NBA season in 'YYYY-YY' format, e.g., 2025-26."""
    today = datetime.now(timezone.utc)
    # NBA season considered July 1 – June 30 of following year
    if today.month >= 7:  # Season starts in summer/fall of calendar year
        start_year = today.year
    else:
        start_year = today.year - 1
    end_year_short = str((start_year + 1) % 100).zfill(2)
    return f"{start_year}-{end_year_short}"


from pydantic import BaseModel
import os

from dotenv import load_dotenv

load_dotenv()

NBA_STATS_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://stats.nba.com/",
    "Origin": "https://stats.nba.com",
}

app = FastAPI(title="NBA Analysis API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models for request/response
# Deprecated InjuryPredictionRequest for now – we accept query params to simplify front-end calls
# If you prefer JSON body, re-enable and adjust the front-end accordingly.
class WeatherResponse(BaseModel):
    city: str
    temperature: float
    humidity: float
    description: str
    wind_speed: float
    pressure: float


# Mock biomechanical data for players
PLAYER_BIOMECHANICS = {
    2544: {"flexibility": 0.8, "muscle_strength": 0.9, "fatigue_index": 0.3},  # LeBron
    201939: {
        "flexibility": 0.9,
        "muscle_strength": 0.85,
        "fatigue_index": 0.2,
    },  # Curry
    201142: {
        "flexibility": 0.85,
        "muscle_strength": 0.95,
        "fatigue_index": 0.25,
    },  # Durant
}


@app.get("/")
async def root():
    return {"message": "NBA Analysis API", "version": "1.0.0"}


@app.get("/players")
async def list_players(active_only: bool = True, limit: int = 0):
    """Return list of NBA players (basic static data)."""
    # Fetch full active roster from NBA CDN (over 500 players). Fallback to nba_api static list.
    import asyncio, functools

    _roster_cache: list | None = None

    async def _download_roster() -> list:
        url = "https://cdn.nba.com/static/json/staticData/squad/active_players.json"
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
        return data.get("league", {}).get("standard", [])

    def get_full_active_players() -> list:
        global _roster_cache
        if _roster_cache is not None:
            return _roster_cache
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        try:
            _roster_cache = loop.run_until_complete(_download_roster())
            if not _roster_cache:
                raise ValueError("Empty roster from CDN")
        except Exception:
            from nba_api.stats.static import players as _ps

            _roster_cache = _ps.get_players()
        return _roster_cache

    all_players = get_full_active_players()
    if active_only:
        all_players = [
            p for p in all_players if p.get("isActive") or p.get("is_active")
        ]
    if limit and limit > 0:
        all_players = all_players[:limit]
    return all_players


@app.get("/players/detailed")
async def list_players_detailed(active_only: bool = True, limit: int = 500):
    """Return players with height/weight and current injury status."""
    all_players = get_full_active_players()
    if active_only:
        all_players = [
            p for p in all_players if p.get("isActive") or p.get("is_active")
        ]
    all_players = all_players[:limit]

    # Build injury lookup once
    injury_lookup = {}
    try:
        injury_resp = await httpx.AsyncClient(timeout=10).get(
            "https://site.web.api.digital.nba.com/stats/injuryreport",
            headers=NBA_STATS_HEADERS,
        )
        if injury_resp.status_code == 200:
            inj_data = injury_resp.json()
            headers_inj = inj_data["resultSets"][0]["headers"]
            for row in inj_data["resultSets"][0]["rowSet"]:
                entry = dict(zip(headers_inj, row))
                injury_lookup[entry["PERSON_ID"]] = {
                    "injury_type": entry.get("INJURY_DESC"),
                    "status": entry.get("STATUS"),
                }
    except Exception:
        pass

    detailed_players = []
    for p in all_players:
        try:
            info = commonplayerinfo.CommonPlayerInfo(
                player_id=p["id"]
            ).get_data_frames()[0]
            height = info.loc[0, "HEIGHT"]  # format 6-6
            weight = info.loc[0, "WEIGHT"]
            feet, inches = (None, None)
            if isinstance(height, str) and "-" in height:
                feet, inches = height.split("-")
            detailed_players.append(
                {
                    **p,
                    "height_feet": int(feet) if feet is not None else None,
                    "height_inches": int(inches) if inches is not None else None,
                    "weight_pounds": int(weight) if weight else None,
                    "current_injury": injury_lookup.get(p["id"], None),
                }
            )
        except Exception:
            detailed_players.append(
                {
                    **p,
                    "height_feet": None,
                    "height_inches": None,
                    "weight_pounds": None,
                    "current_injury": injury_lookup.get(p["id"], None),
                }
            )

    return detailed_players


# ------------------ Cached summary of active players ------------------

from datetime import timedelta
from functools import lru_cache


# Simple in-memory cache so we don't hammer stats.nba.com on every request.
# Results are recomputed at most once every 6 hours.


SUMMARY_CACHE: dict = {"timestamp": None, "data": None}
CACHE_HOURS = 6

# Concurrency guard so only one expensive build runs at a time
import asyncio

_summary_lock = asyncio.Lock()


def _height_str_to_ft_in(height_str: str):
    """Convert '6-7' → (6,7)."""
    if height_str and "-" in height_str:
        ft, inch = height_str.split("-")
        return int(ft), int(inch)
    return None, None


def _get_next_game(team_abbrev: str, board: Optional[dict]) -> Optional[dict]:
    """Return the team's next game info from a given scoreboard dict (or None)."""
    if not board:
        return None

    for g in board.get("scoreboard", {}).get("games", []):
        if team_abbrev in (
            g.get("homeTeam", {}).get("teamTricode"),
            g.get("awayTeam", {}).get("teamTricode"),
        ):
            return {
                "home": g.get("homeTeam", {}).get("teamTricode"),
                "away": g.get("awayTeam", {}).get("teamTricode"),
                "game_time": g.get("gameEt") or g.get("gameTimeUTC"),
            }
    return None


@app.get("/players/summary")
async def players_summary(force: bool = False, season: str | None = None):
    """Return all active players with height/weight, season averages and next game in a single payload."""
    global SUMMARY_CACHE

    now = datetime.now(timezone.utc)
    if (not force) and (
        SUMMARY_CACHE["data"]
        and SUMMARY_CACHE["timestamp"]
        and (now - SUMMARY_CACHE["timestamp"]) < timedelta(hours=CACHE_HOURS)
    ):
        return SUMMARY_CACHE["data"]

    cache_file = (
        CACHE_DIR / f"players_{(season or current_season()).replace('-', '')}.json"
    )

    # Try disk cache first if not force
    if not force and cache_file.exists():
        try:
            return json.loads(cache_file.read_text())
        except Exception:
            pass  # corrupted file; ignore

    async with _summary_lock:
        # Double-check in case another waiter already built it
        if (
            SUMMARY_CACHE["data"]
            and SUMMARY_CACHE["timestamp"]
            and (datetime.now(timezone.utc) - SUMMARY_CACHE["timestamp"])
            < timedelta(hours=CACHE_HOURS)
        ):
            return SUMMARY_CACHE["data"]

        # ----------------- Build fresh -----------------
        stats_df = leaguedashplayerstats.LeagueDashPlayerStats(
            season=season or current_season(), per_mode_detailed="PerGame"
        ).get_data_frames()[0]

        # Filter active players only
        stats_df = stats_df[stats_df["GP"] > 0]

        teams_list = teams.get_teams()
        team_lookup = {t["id"]: (t["abbreviation"], t["full_name"]) for t in teams_list}

        # Injury report once
        injury_lookup = {}
        try:
            injury_resp = httpx.get(
                "https://site.web.api.digital.nba.com/stats/injuryreport",
                headers=NBA_STATS_HEADERS,
                timeout=10,
            )
            if injury_resp.status_code == 200:
                inj_data = injury_resp.json()
                headers_inj = inj_data["resultSets"][0]["headers"]
                for row in inj_data["resultSets"][0]["rowSet"]:
                    entry = dict(zip(headers_inj, row))
                    injury_lookup[entry["PERSON_ID"]] = {
                        "injury_type": entry.get("INJURY_DESC"),
                        "status": entry.get("STATUS"),
                    }
        except Exception:
            pass

        # Fetch today's scoreboard ONCE – some days the endpoint fails; that's okay, we fall back to None
        try:
            board_today = live_scoreboard.ScoreBoard().get_dict()
        except Exception:
            board_today = None

        stats_by_id = {int(r["PLAYER_ID"]): r for _, r in stats_df.iterrows()}

        active_players = [
            p
            for p in get_full_active_players()
            if p.get("isActive") or p.get("is_active")
        ]

        summary = []
        for p in active_players:
            pid = int(p.get("personId") or p.get("id"))
            rd = stats_by_id.get(pid, {})

            # Team info
            team_id = rd.get("TEAM_ID") or p.get("teamId") or p.get("team_id") or 0
            team_abbrev, team_full = team_lookup.get(int(team_id), (None, None))

            # Height/weight
            feet = inches = None
            height_raw = rd.get("PLAYER_HEIGHT")
            if height_raw:
                feet, inches = _height_str_to_ft_in(height_raw)

            weight_val = rd.get("PLAYER_WEIGHT") or rd.get("PLAYER_WEIGHT_LBS")

            summary.append(
                {
                    "id": pid,
                    "full_name": p.get("firstName", "") + " " + p.get("lastName", ""),
                    "first_name": p.get("firstName") or p.get("first_name"),
                    "last_name": p.get("lastName") or p.get("last_name"),
                    "is_active": True,
                    "team_id": int(team_id) if team_id else None,
                    "team_abbreviation": team_abbrev,
                    "team_full_name": team_full,
                    "position": p.get("pos")
                    or rd.get("POSITION")
                    or rd.get("PLAYER_POSITION"),
                    "height_feet": feet,
                    "height_inches": inches,
                    "weight_pounds": int(weight_val) if weight_val else None,
                    "headshot_url": f"https://cdn.nba.com/headshots/nba/latest/1040x760/{pid}.png",
                    "season_averages": {
                        "pts": rd.get("PTS", 0),
                        "reb": rd.get("REB", 0),
                        "ast": rd.get("AST", 0),
                        "stl": rd.get("STL", 0),
                        "blk": rd.get("BLK", 0),
                        "fg_pct": rd.get("FG_PCT"),
                        "fg3_pct": rd.get("FG3_PCT"),
                        "ft_pct": rd.get("FT_PCT"),
                        "min": rd.get("MIN"),
                    },
                    "current_injury": injury_lookup.get(pid),
                }
            )

        # ---------- Patch missing height/weight quickly (rare blanks in bulk feed) ----------
        missing_ids = [
            p["id"]
            for p in summary
            if p["height_feet"] is None or p["weight_pounds"] is None
        ]
        if missing_ids:
            from nba_api.stats.endpoints import commonplayerinfo as _cpi

            for pid in missing_ids:
                try:
                    info_df = _cpi.CommonPlayerInfo(
                        player_id=str(pid)
                    ).get_data_frames()[0]
                    h = info_df.loc[0, "HEIGHT"]
                    w = info_df.loc[0, "WEIGHT"]
                    ft, inch = (
                        _height_str_to_ft_in(h) if isinstance(h, str) else (None, None)
                    )
                    for p in summary:
                        if p["id"] == pid:
                            if ft is not None:
                                p["height_feet"], p["height_inches"] = ft, inch
                            if w:
                                p["weight_pounds"] = int(w)
                            break
                except Exception:
                    continue

        SUMMARY_CACHE = {"timestamp": datetime.now(timezone.utc), "data": summary}

        # Persist to disk
        try:
            cache_file.write_text(json.dumps(summary))
        except Exception:
            pass
        return summary


# ---------- Quick player info (height/weight) -----------


@app.get("/player/{player_id}/info")
async def get_player_info(player_id: int):
    """Return height (feet/inches) and weight for a single player."""
    try:
        info = commonplayerinfo.CommonPlayerInfo(
            player_id=str(player_id)
        ).get_data_frames()[0]
        height = info.loc[0, "HEIGHT"]  # 6-6
        weight = info.loc[0, "WEIGHT"]
        feet, inches = (None, None)
        if isinstance(height, str) and "-" in height:
            feet, inches = height.split("-")
        return {
            "player_id": player_id,
            "height_feet": int(feet) if feet else None,
            "height_inches": int(inches) if inches else None,
            "weight_pounds": int(weight) if weight else None,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/teams")
async def list_teams():
    """Return list of NBA teams."""
    return teams.get_teams()


@app.get("/player/{player_id}/career")
async def get_player_career(player_id: int):
    """Get career statistics for a specific player."""
    try:
        career = playercareerstats.PlayerCareerStats(player_id=str(player_id))
        return career.get_dict()
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Player not found: {str(e)}")


@app.get("/player/{player_id}/injury-history")
async def get_injury_history(player_id: int):
    """Fetch current injury status for a player from the league injury report."""
    url = "https://site.web.api.digital.nba.com/stats/injuryreport"
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(url, headers=NBA_STATS_HEADERS, timeout=10)
            resp.raise_for_status()
        except Exception:
            # Could not fetch injury report; return empty
            return {"player_id": player_id, "injuries": []}

    report = resp.json()

    player_injuries = [
        row for row in report.get("resultSets", [])[0]["rowSet"] if row[0] == player_id
    ]
    if not player_injuries:
        return {"player_id": player_id, "injuries": []}

    headers = report["resultSets"][0]["headers"]
    injuries_raw = [dict(zip(headers, row)) for row in player_injuries]
    injuries = []
    for item in injuries_raw:
        injuries.append(
            {
                "date": item.get("GAME_DATE"),
                "injury_type": item.get("INJURY_DESC") or item.get("DESCRIPTION"),
                "games_missed": item.get("GAMES_MISSED", 0),
                "severity": item.get("STATUS") or item.get("INJURY_STATUS"),
            }
        )

    return {"player_id": player_id, "injuries": injuries}


@app.get("/player/{player_id}/gamelog")
async def get_recent_games(
    player_id: int,
    season: str | None = None,
    last_n: int = 10,
):
    """Return the last N games for a player with basic statistics."""
    from nba_api.stats.endpoints import playergamelog

    if season is None:
        season = current_season()

    try:
        log = playergamelog.PlayerGameLog(player_id=str(player_id), season=season)
        df = log.get_data_frames()[0].head(last_n)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    games = df[
        ["GAME_DATE", "MATCHUP", "PTS", "REB", "AST", "STL", "BLK", "PLUS_MINUS"]
    ].to_dict("records")
    return {"player_id": player_id, "games": games}


@app.post("/predict_injury")
async def predict_injury(
    player_id: int,
    temperature: float = 72.0,
    humidity: float = 50.0,
    minutes_played: float = 30.0,
    games_in_last_week: int = 3,
    previous_injuries: int = 0,
):
    """
    Predict injury risk for a player based on multiple factors.
    This is a sophisticated mock implementation.
    """
    # Base risk calculation
    base_risk = 0.15  # 15% baseline

    # Environmental factors
    if temperature > 85 or temperature < 50:
        base_risk += 0.1
    if humidity > 70:
        base_risk += 0.05

    # Workload factors
    if minutes_played > 35:
        base_risk += 0.08
    if games_in_last_week > 4:
        base_risk += 0.12

    # Previous injury history
    base_risk += previous_injuries * 0.05

    # Biomechanical factors (if available)
    bio_data = PLAYER_BIOMECHANICS.get(player_id, {})
    if bio_data:
        if bio_data.get("fatigue_index", 0) > 0.5:
            base_risk += 0.1
        if bio_data.get("flexibility", 1) < 0.7:
            base_risk += 0.08

    # Add some randomness for demo
    base_risk += random.uniform(-0.05, 0.05)

    # Ensure risk is between 0 and 1
    risk = min(max(base_risk, 0), 1)

    # Determine risk level
    if risk > 0.7:
        risk_level = "High"
    elif risk > 0.4:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    # Injury type prediction
    injury_types = []
    if temperature < 50:
        injury_types.append("Muscle Strain (Cold Weather)")
    if games_in_last_week > 4:
        injury_types.append("Fatigue-Related Injury")
    if previous_injuries > 2:
        injury_types.append("Re-injury Risk")

    return {
        "player_id": player_id,
        "injury_risk": round(risk, 3),
        "risk_level": risk_level,
        "contributing_factors": {
            "environmental": {
                "temperature": temperature,
                "humidity": humidity,
                "impact": "High" if temperature > 85 or temperature < 50 else "Low",
            },
            "workload": {
                "minutes_played": minutes_played,
                "games_in_last_week": games_in_last_week,
                "impact": "High" if games_in_last_week > 4 else "Moderate",
            },
            "biomechanical": bio_data,
            "injury_history": {
                "previous_injuries": previous_injuries,
                "impact": "High" if previous_injuries > 2 else "Low",
            },
        },
        "potential_injury_types": injury_types,
        "recommendations": [
            "Monitor playing time" if minutes_played > 35 else None,
            "Consider load management" if games_in_last_week > 4 else None,
            "Focus on recovery protocols" if risk > 0.5 else None,
            "Adjust training intensity"
            if bio_data.get("fatigue_index", 0) > 0.5
            else None,
        ],
        "timestamp": datetime.now().isoformat(),
    }


# bulk cache
BULK_CACHE: dict = {"timestamp": None, "data": {}}
BULK_CACHE_HOURS = 6


@app.post("/predict_injury/bulk")
async def predict_injury_bulk(player_ids: List[int]):
    """Return injury predictions for many players in one shot (cached)."""

    now = datetime.utcnow()
    # return cached subset if available and fresh
    if (
        BULK_CACHE["data"]
        and BULK_CACHE["timestamp"]
        and (now - BULK_CACHE["timestamp"]) < timedelta(hours=BULK_CACHE_HOURS)
        and all(pid in BULK_CACHE["data"] for pid in player_ids)
    ):
        return {pid: BULK_CACHE["data"][pid] for pid in player_ids}

    predictions = {}
    for pid in player_ids:
        res = await predict_injury(pid)  # reuse existing logic
        predictions[pid] = res

    # merge into cache
    if not BULK_CACHE["timestamp"] or (
        now - (BULK_CACHE["timestamp"] or now)
    ) > timedelta(hours=BULK_CACHE_HOURS):
        BULK_CACHE["data"] = predictions.copy()
        BULK_CACHE["timestamp"] = now
    else:
        BULK_CACHE["data"].update(predictions)

    return predictions


OPENWEATHER_KEY = os.getenv("OPENWEATHER_KEY")


@app.get("/weather/{city}")
async def get_weather(city: str) -> WeatherResponse:
    """Get current weather for the given city using OpenWeatherMap."""
    if not OPENWEATHER_KEY:
        raise HTTPException(
            status_code=500, detail="OPENWEATHER_KEY not set in environment"
        )

    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {
        "q": city,
        "appid": OPENWEATHER_KEY,
        "units": "imperial",
    }

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params=params)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        data = resp.json()

    return WeatherResponse(
        city=city,
        temperature=data["main"]["temp"],
        humidity=data["main"]["humidity"],
        description=data["weather"][0]["description"].title(),
        wind_speed=data["wind"]["speed"],
        pressure=data["main"]["pressure"],
    )


# ------------------- Scoreboard -------------------


@app.get("/scoreboard")
async def get_scoreboard(game_date: Optional[str] = None):
    """Return today's scoreboard (or specific YYYY-MM-DD)."""
    try:
        board = live_scoreboard.ScoreBoard(game_date=game_date)
        return board.get_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/analytics/league-trends")
async def get_league_trends():
    """Get league-wide injury trends and analytics."""
    return {
        "average_injury_rate": 0.285,
        "trending_up": ["Ankle injuries", "Load management"],
        "trending_down": ["ACL tears", "Concussions"],
        "high_risk_positions": ["C", "PF"],
        "seasonal_trends": {
            "early_season": 0.22,
            "mid_season": 0.31,
            "late_season": 0.38,
            "playoffs": 0.28,
        },
        "team_injury_rates": {
            "LAL": 0.24,
            "GSW": 0.29,
            "MIL": 0.21,
            "BOS": 0.26,
            "PHX": 0.33,
        },
    }


# ----------------- Aggregate factor scores for radar chart -----------------


@app.get("/analytics/factors")
async def get_factor_scores():
    """Return aggregate 0-100 scores for key risk factor categories using cached predictions."""

    if not BULK_CACHE["data"]:
        # No cached predictions yet – return neutral 50s so UI still renders.
        return {
            "environmental": 50,
            "biomechanical": 50,
            "workload": 50,
            "recovery": 50,
            "historical": 50,
        }

    env_vals = []
    bio_vals = []
    work_vals = []
    hist_vals = []

    for pred in BULK_CACHE["data"].values():
        cf = pred.get("contributing_factors", {})

        # Environmental impact score
        impact = cf.get("environmental", {}).get("impact")
        env_vals.append(100 if impact == "High" else 60 if impact == "Moderate" else 30)

        # Workload impact
        w_impact = cf.get("workload", {}).get("impact")
        work_vals.append(
            100 if w_impact == "High" else 60 if w_impact == "Moderate" else 30
        )

        # Biomechanical: use fatigue_index if present (0-1 scale → 0-100)
        bio = cf.get("biomechanical", {}).get("fatigue_index")
        if bio is not None:
            bio_vals.append(min(max(bio, 0), 1) * 100)

        # Injury history impact
        h_impact = cf.get("injury_history", {}).get("impact")
        hist_vals.append(100 if h_impact == "High" else 30)

    def avg(vals, fallback=50):
        return round(sum(vals) / len(vals), 1) if vals else fallback

    return {
        "environmental": avg(env_vals),
        "workload": avg(work_vals),
        "biomechanical": avg(bio_vals),
        "historical": avg(hist_vals),
        "recovery": 65,  # Placeholder – real model could incorporate sleep metrics etc.
    }


SHOT_CACHE: dict = {"timestamp": {}, "data": {}}  # key (pid, season)
SHOT_CACHE_HOURS = 12


@app.get("/player/{player_id}/shotchart")
async def get_shot_chart(player_id: int, season: str | None = None):
    """Return basic shot chart coordinates for a player (cached)."""
    from nba_api.stats.endpoints import shotchartdetail

    if season is None:
        season = current_season()

    key = (player_id, season)
    now = datetime.utcnow()
    ts = SHOT_CACHE["timestamp"].get(key)
    if ts and (now - ts) < timedelta(hours=SHOT_CACHE_HOURS):
        return SHOT_CACHE["data"][key]

    def _fetch_df(seas: str | None):
        sc = shotchartdetail.ShotChartDetail(
            player_id=str(player_id),
            season_type_all_star="Regular Season",
            season_nullable=seas,
            context_measure_simple="FGA",
        )
        return sc.get_data_frames()[0]

    def _try_fetch(seas: str | None):
        try:
            return _fetch_df(seas)
        except Exception:
            return None

    df = _try_fetch(season)
    # Fallback: previous season if none or empty
    if (df is None or df.empty) and season:
        yr_start = int(season.split("-")[0]) - 1
        prev_season = f"{yr_start}-{str((yr_start + 1) % 100).zfill(2)}"
        df = _try_fetch(prev_season)
        season = prev_season if df is not None else season

    if df is None:
        # final fallback: let nba_api decide
        df = _try_fetch(None) or None

    if df is None or df.empty:
        return []

    shots = df[
        [
            "LOC_X",
            "LOC_Y",
            "SHOT_MADE_FLAG",
            "SHOT_DISTANCE",
            "ACTION_TYPE",
            "SHOT_TYPE",
        ]
    ].to_dict("records")

    for s in shots:
        s["made"] = bool(s.pop("SHOT_MADE_FLAG"))

    SHOT_CACHE["data"][key] = shots
    SHOT_CACHE["timestamp"][key] = now
    return shots


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
