import os
import asyncio
import json
import random
from datetime import datetime, timezone
from typing import Optional, List, Dict
import websockets
from fastapi import WebSocket

connected_clients = set()

# In-memory deduplicated cache of REAL vessels received from AISStream
# Key: MMSI string
real_vessels_cache: Dict[str, dict] = {}
MAX_CACHE_SIZE = 500

# Broad world ocean bounding boxes covering major maritime corridors:
# Atlantic, Pacific, Indian Ocean, Mediterranean, English Channel, SE Asia, etc.
GLOBAL_BOUNDING_BOXES = [
    # North Atlantic / English Channel / North Sea
    [[45.0, -15.0], [60.0, 10.0]],
    # Mediterranean Sea / Suez
    [[28.0, -6.0], [40.0, 36.0]],
    # Arabian Sea / Persian Gulf / Indian Ocean
    [[10.0, 45.0], [28.0, 78.0]],
    # Bay of Bengal / Malacca Strait / Singapore
    [[0.0, 78.0], [18.0, 105.0]],
    # South China Sea / East Asia
    [[10.0, 105.0], [38.0, 130.0]],
    # US East Coast / Gulf of Mexico / Caribbean
    [[15.0, -98.0], [45.0, -65.0]],
    # US West Coast / Pacific
    [[25.0, -128.0], [50.0, -115.0]],
    # Cape of Good Hope / South Africa
    [[-40.0, 12.0], [-25.0, 35.0]],
    # Australia / Oceania
    [[-40.0, 110.0], [-10.0, 155.0]],
]

def normalize_aisstream_message(message: dict) -> Optional[dict]:
    """
    Strictly normalizes real AISStream PositionReport messages.
    Guarantees that MMSI and other properties conform to the authoritative schema:
    {
        "mmsi": "string or number" or None,
        "shipName": "string",
        "lat": number,
        "lon": number,
        "sog": number | None,
        "cog": number | None,
        "timestamp": string | None,
        "source": "AISSTREAM_LIVE"
    }
    Never calls or allows undefined.toString().
    """
    if not isinstance(message, dict):
        return None
    
    msg_type = message.get("MessageType")
    if msg_type != "PositionReport":
        return None
        
    msg_body = message.get("Message")
    if not isinstance(msg_body, dict):
        return None
        
    report = msg_body.get("PositionReport")
    if not isinstance(report, dict):
        return None
        
    meta = message.get("MetaData")
    if not isinstance(meta, dict):
        meta = {}
        
    # Extract MMSI safely
    raw_mmsi = meta.get("MMSI")
    if raw_mmsi is None:
        raw_mmsi = meta.get("MMSI_String")
    if raw_mmsi is None:
        raw_mmsi = report.get("UserID")
        
    if raw_mmsi is not None:
        mmsi_str = str(raw_mmsi).strip()
        if not mmsi_str or mmsi_str.lower() in ("none", "undefined", "null", "0"):
            mmsi = None
        else:
            mmsi = mmsi_str
    else:
        mmsi = None

    # Extract Ship Name safely
    raw_name = meta.get("ShipName")
    if raw_name is not None and str(raw_name).strip():
        ship_name = str(raw_name).strip()
    elif mmsi is not None:
        ship_name = f"VESSEL {mmsi}"
    else:
        ship_name = "UNKNOWN VESSEL"

    # Extract Lat and Lon safely
    lat_val = report.get("Latitude")
    if lat_val is None:
        lat_val = meta.get("latitude")
    try:
        lat = float(lat_val) if lat_val is not None else None
        if lat is not None and (lat < -90.0 or lat > 90.0 or abs(lat) < 0.00001):
            lat = None
    except (ValueError, TypeError):
        lat = None

    lon_val = report.get("Longitude")
    if lon_val is None:
        lon_val = meta.get("longitude")
    try:
        lon = float(lon_val) if lon_val is not None else None
        if lon is not None and (lon < -180.0 or lon > 180.0 or abs(lon) < 0.00001):
            lon = None
    except (ValueError, TypeError):
        lon = None

    if lat is None or lon is None:
        return None

    # Extract SOG safely
    sog_val = report.get("Sog")
    try:
        sog = float(sog_val) if sog_val is not None else None
        if sog is not None and (sog < 0 or sog > 102.2):
            sog = None
    except (ValueError, TypeError):
        sog = None

    # Extract COG safely
    cog_val = report.get("Cog")
    try:
        cog = float(cog_val) if cog_val is not None else None
        if cog is not None and (cog < 0 or cog > 360.0):
            cog = None
    except (ValueError, TypeError):
        cog = None

    # Extract Timestamp safely
    ts_val = meta.get("time_utc") or meta.get("Timestamp")
    if ts_val is not None and str(ts_val).strip():
        ts_str = str(ts_val).strip()
    else:
        ts_str = datetime.now(timezone.utc).isoformat()

    return {
        "mmsi": mmsi,
        "shipName": ship_name,
        "lat": round(lat, 5),
        "lon": round(lon, 5),
        "sog": round(sog, 1) if sog is not None else None,
        "cog": round(cog, 1) if cog is not None else None,
        "timestamp": ts_str,
        "source": "AISSTREAM_LIVE"
    }

def get_random_real_vessels(count: int = 20) -> List[dict]:
    """
    Returns up to count real vessels randomly sampled from deduplicated real AIS cache.
    NEVER fabricates ships or data.
    """
    all_vessels = list(real_vessels_cache.values())
    if not all_vessels:
        return []
    if len(all_vessels) <= count:
        return all_vessels
    return random.sample(all_vessels, count)

async def broadcast_vessel(vessel: dict):
    """
    Broadcasts a normalized vessel to all connected frontend clients.
    """
    disconnected = set()
    for client in list(connected_clients):
        try:
            await client.send_json(vessel)
        except Exception:
            disconnected.add(client)
    for client in disconnected:
        connected_clients.discard(client)

async def connect_to_aisstream():
    """
    Long-lived background service that connects to AISStream via WebSocket.
    Broad global ocean bounding boxes without SAR bounds restriction.
    Maintains a deduplicated cache of real vessels.
    """
    api_key = os.environ.get("AISSTREAM_API_KEY")
    if not api_key:
        print("[AISStream] Warning: AISSTREAM_API_KEY not configured. Live AIS stream disabled.")
        return

    subscribe_message = {
        "APIKey": api_key,
        "BoundingBoxes": GLOBAL_BOUNDING_BOXES,
        "FilterMessageTypes": ["PositionReport"]
    }

    backoff = 2
    max_backoff = 30

    while True:
        try:
            print(f"[AISStream] Connecting to AISStream with {len(GLOBAL_BOUNDING_BOXES)} global ocean zones...")
            async with websockets.connect(
                "wss://stream.aisstream.io/v0/stream",
                ping_interval=20,
                ping_timeout=20,
                close_timeout=10
            ) as ws:
                await ws.send(json.dumps(subscribe_message))
                print("[AISStream] Successfully connected and subscribed to global live feed.")
                backoff = 2 # Reset backoff on successful connection

                async for message_str in ws:
                    try:
                        raw = json.loads(message_str)
                        normalized = normalize_aisstream_message(raw)
                        if normalized:
                            # Cache by MMSI (or fallback to coord key if no MMSI)
                            cache_key = normalized["mmsi"] or f"{normalized['lat']}_{normalized['lon']}"
                            real_vessels_cache[cache_key] = normalized

                            # Keep cache bounded
                            if len(real_vessels_cache) > MAX_CACHE_SIZE:
                                oldest_key = next(iter(real_vessels_cache))
                                del real_vessels_cache[oldest_key]

                            # Broadcast real vessel to frontend
                            await broadcast_vessel(normalized)

                    except json.JSONDecodeError:
                        continue
                    except Exception as e:
                        print(f"[AISStream] Error processing message: {e}")
                        continue

        except Exception as e:
            print(f"[AISStream] Connection error: {e}. Reconnecting in {backoff}s...")
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, max_backoff)
