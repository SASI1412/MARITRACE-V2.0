import os
import sys

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import io
import uuid
from typing import Optional
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import cv2
from PIL import Image, UnidentifiedImageError

from services.gemini_service import analyze_image_with_gemini
from services.aisstream_service import connect_to_aisstream, connected_clients, get_random_real_vessels
from fastapi import WebSocket, WebSocketDisconnect
from dotenv import load_dotenv

# Load environment variables from backend/.env or root .env
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv()

app = FastAPI(title="MARITRACE V2 API")

# Allow CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create static directory to serve images
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

def generate_slick_data(image: Image.Image, geo_bounds: Optional[dict], confidence: float):
    """
    Generates a clean contiguous slick polygon and visual overlay
    using morphological processing on the SAR image.
    """
    orig_w, orig_h = image.size
    img_gray = np.array(image.convert("L"))
    
    # In SAR imagery, oil slicks attenuate capillary waves, appearing as dark anomalies.
    blurred = cv2.GaussianBlur(img_gray, (5, 5), 0)
    thresh_val = max(30, min(100, int(np.percentile(blurred, 30))))
    _, dark_mask = cv2.threshold(blurred, thresh_val, 255, cv2.THRESH_BINARY_INV)
    
    # Morphological processing to extract clean contiguous features
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    cleaned = cv2.morphologyEx(dark_mask, cv2.MORPH_OPEN, kernel, iterations=1)
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kernel, iterations=2)
    
    contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Keep significant contiguous slick contours
    valid_contours = [cnt for cnt in contours if cv2.contourArea(cnt) > 40]
    if not valid_contours and contours:
        largest = max(contours, key=cv2.contourArea)
        if cv2.contourArea(largest) > 10:
            valid_contours = [largest]
            
    # Create clean overlay highlighting the slick in cyan
    overlay_array = np.zeros((orig_h, orig_w, 4), dtype=np.uint8)
    for cnt in valid_contours:
        cv2.drawContours(overlay_array, [cnt], -1, (0, 229, 255, 140), thickness=cv2.FILLED)
        cv2.drawContours(overlay_array, [cnt], -1, (0, 229, 255, 230), thickness=2)
    overlay_img = Image.fromarray(overlay_array, mode='RGBA')
    
    geojson_data = None
    if geo_bounds and valid_contours:
        north = geo_bounds["north"]
        south = geo_bounds["south"]
        east = geo_bounds["east"]
        west = geo_bounds["west"]
        
        def px_to_geo(x, y):
            lon = west + (x / orig_w) * (east - west)
            lat = north - (y / orig_h) * (north - south)
            return [round(float(lon), 6), round(float(lat), 6)]
            
        features = []
        for cnt in valid_contours:
            epsilon = 0.003 * cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, epsilon, True)
            if len(approx) < 3:
                continue
            poly_coords = [px_to_geo(pt[0][0], pt[0][1]) for pt in approx]
            poly_coords.append(poly_coords[0]) # Close the ring
            
            area_px = int(cv2.contourArea(cnt))
            features.append({
                "type": "Feature",
                "properties": {
                    "class": "oil",
                    "source": "SAR_ANALYSIS",
                    "confidence": float(confidence),
                    "pixel_count": area_px,
                    "pixel_percentage": round((float(area_px) / (orig_w * orig_h)) * 100.0, 2)
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [poly_coords]
                }
            })
            
        if features:
            geojson_data = {
                "type": "FeatureCollection",
                "features": features
            }
            
    return geojson_data, overlay_img

@app.on_event("startup")
async def startup_event():
    import asyncio
    asyncio.create_task(connect_to_aisstream())

@app.get("/api/live-ais")
async def get_live_ais():
    vessels = get_random_real_vessels(20)
    return {
        "success": True,
        "vessels": vessels,
        "count": len(vessels)
    }

@app.websocket("/ws/ais")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    try:
        # Immediately send snapshot of up to 20 random real vessels
        initial_sample = get_random_real_vessels(20)
        await websocket.send_json({
            "type": "snapshot",
            "vessels": initial_sample
        })
        while True:
            msg = await websocket.receive_text()
            try:
                import json
                data = json.loads(msg)
                if data.get("action") == "refresh":
                    sample = get_random_real_vessels(20)
                    await websocket.send_json({
                        "type": "snapshot",
                        "vessels": sample
                    })
            except Exception:
                pass
    except WebSocketDisconnect:
        connected_clients.discard(websocket)
    except Exception:
        connected_clients.discard(websocket)

@app.post("/api/analyze-sar")
async def analyze_sar(
    file: UploadFile = File(...),
    north_lat: Optional[float] = Form(None),
    south_lat: Optional[float] = Form(None),
    east_lon: Optional[float] = Form(None),
    west_lon: Optional[float] = Form(None)
):
    valid_extensions = {".png", ".jpg", ".jpeg"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in valid_extensions:
        raise HTTPException(status_code=400, detail="Invalid file type. Only PNG, JPG, JPEG are allowed.")
    
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")
        
    try:
        image = Image.open(io.BytesIO(content))
        image.verify()
    except UnidentifiedImageError:
        raise HTTPException(status_code=400, detail="Corrupted or invalid image file.")
        
    image = Image.open(io.BytesIO(content))
    
    geo_bounds = None
    if all(v is not None for v in [north_lat, south_lat, east_lon, west_lon]):
        if north_lat <= south_lat or east_lon <= west_lon:
            raise HTTPException(status_code=400, detail="Invalid bounds. North must be > South and East must be > West.")
        geo_bounds = {
            "north": north_lat,
            "south": south_lat,
            "east": east_lon,
            "west": west_lon
        }
    
    # Authoritative Gemini Classification
    gemini_result = analyze_image_with_gemini(image)
    
    classification = gemini_result.get("classification", "UNCERTAIN")
    try:
        confidence = float(gemini_result.get("confidence", 0))
    except (ValueError, TypeError):
        confidence = 0.0
    
    # Authoritative gate rule: strictly > 70.0% and OIL_SPILL
    oil_detected = (classification == "OIL_SPILL" and confidence > 70.0)
    
    if not oil_detected:
        return {
            "success": True,
            "oil_detected": False,
            "classification": classification,
            "confidence": confidence,
            "model_confidence": confidence,
            "gemini_result": gemini_result,
            "geojson": None,
            "georeferenced": geo_bounds is not None,
            "urls": None
        }
    
    # Generate slick overlay and GeoJSON using morphological processing
    try:
        geojson_data, overlay_img = generate_slick_data(image, geo_bounds, confidence)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating slick geometry: {str(e)}")
        
    job_id = str(uuid.uuid4())
    orig_filename = f"{job_id}_original{ext}"
    overlay_filename = f"{job_id}_overlay.png"
    
    orig_path = os.path.join(STATIC_DIR, orig_filename)
    overlay_path = os.path.join(STATIC_DIR, overlay_filename)
    
    image.save(orig_path)
    overlay_img.save(overlay_path)
    
    return {
        "success": True,
        "oil_detected": True,
        "classification": classification,
        "confidence": confidence,
        "model_confidence": confidence,
        "gemini_result": gemini_result,
        "geojson": geojson_data,
        "georeferenced": geo_bounds is not None,
        "urls": {
            "original": f"/static/{orig_filename}",
            "overlay": f"/static/{overlay_filename}"
        }
    }
