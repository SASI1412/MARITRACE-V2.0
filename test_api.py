import os
import sys
import json
from unittest.mock import patch
from PIL import Image

sys.path.append(os.path.abspath('backend'))
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

# Test 1: No bounds, Gray image (Negative / Look-alike)
img = Image.new('RGB', (512, 512), color='gray')
img.save('test_input_gray.png')

with open('test_input_gray.png', 'rb') as f:
    resp1 = client.post("/api/analyze-sar", files={"file": ("test_input_gray.png", f, "image/png")})

print("TEST 1: No bounds")
print(f"Status: {resp1.status_code}")
assert resp1.status_code == 200
data1 = resp1.json()
print(f"Georeferenced: {data1.get('georeferenced')}")
print(f"Oil detected: {data1.get('oil_detected')}")
print(f"GeoJSON: {'Present' if data1.get('geojson') else 'Null'}")
print(f"URLs: {data1.get('urls')}")
assert data1.get('georeferenced') is False
assert data1.get('geojson') is None
assert data1.get('urls') is None
    
# Test 2: Valid bounds, Negative / Aborted case
with open('test_input_gray.png', 'rb') as f:
    resp2 = client.post("/api/analyze-sar", 
        files={"file": ("test_input_gray.png", f, "image/png")},
        data={
            "north_lat": 19.5,
            "south_lat": 19.0,
            "west_lon": 70.5,
            "east_lon": 71.5
        }
    )

print("\nTEST 2: With bounds (Negative)")
print(f"Status: {resp2.status_code}")
assert resp2.status_code == 200
data2 = resp2.json()
print(f"Georeferenced: {data2.get('georeferenced')}")
print(f"Oil detected: {data2.get('oil_detected')}")
print(f"GeoJSON: {'Present' if data2.get('geojson') else 'Null'}")
assert data2.get('georeferenced') is True
assert data2.get('oil_detected') is False
assert data2.get('geojson') is None
assert data2.get('urls') is None

# Test 3: Gate Boundary Check — Exactly 70.0% confidence MUST fail (strictly > 70)
with patch("backend.main.analyze_image_with_gemini") as mock_gemini:
    mock_gemini.return_value = {
        "classification": "OIL_SPILL",
        "confidence": 70.0,
        "reasoning": "Borderline anomaly, exactly at 70% threshold.",
        "oil_indicators": ["dark patch"],
        "look_alike_indicators": ["wind shadow possible"],
        "alternative_explanation": "Low wind area",
        "visual_indicators": [],
        "warnings": []
    }
    with open('test_input_gray.png', 'rb') as f:
        resp3 = client.post("/api/analyze-sar",
            files={"file": ("test_input_gray.png", f, "image/png")},
            data={"north_lat": 19.5, "south_lat": 19.0, "west_lon": 70.5, "east_lon": 71.5}
        )
    print("\nTEST 3: Boundary Test (OIL_SPILL with confidence == 70.0%)")
    print(f"Status: {resp3.status_code}")
    data3 = resp3.json()
    print(f"Oil detected: {data3.get('oil_detected')}")
    print(f"GeoJSON: {'Present' if data3.get('geojson') else 'Null'}")
    assert data3.get('oil_detected') is False, "Gate check must fail if confidence is not strictly > 70%"
    assert data3.get('geojson') is None
    assert data3.get('urls') is None

# Test 4: Positive Case — Confidence > 70% (e.g. 88.0%)
# Create an image with a dark slick anomaly
img_slick = Image.new('RGB', (256, 256), color=(180, 180, 180))
for x in range(60, 120):
    for y in range(60, 120):
        img_slick.putpixel((x, y), (30, 30, 30))
img_slick.save('test_input_slick.png')

with patch("backend.main.analyze_image_with_gemini") as mock_gemini:
    mock_gemini.return_value = {
        "classification": "OIL_SPILL",
        "confidence": 88.0,
        "reasoning": "High-confidence coherent dark anomaly consistent with oil spill.",
        "oil_indicators": ["High contrast", "Sharp boundary", "Damped capillary waves"],
        "look_alike_indicators": [],
        "alternative_explanation": "None",
        "visual_indicators": ["Sharp slick edges"],
        "warnings": []
    }
    with open('test_input_slick.png', 'rb') as f:
        resp4 = client.post("/api/analyze-sar",
            files={"file": ("test_input_slick.png", f, "image/png")},
            data={"north_lat": 19.5, "south_lat": 19.0, "west_lon": 70.5, "east_lon": 71.5}
        )
    print("\nTEST 4: Positive Case (OIL_SPILL with confidence == 88.0%)")
    print(f"Status: {resp4.status_code}")
    assert resp4.status_code == 200
    data4 = resp4.json()
    print(f"Oil detected: {data4.get('oil_detected')}")
    print(f"Classification: {data4.get('classification')}")
    print(f"Confidence: {data4.get('confidence')}")
    print(f"GeoJSON: {'Present' if data4.get('geojson') else 'Null'}")
    print(f"URLs: {data4.get('urls')}")
    assert data4.get('oil_detected') is True
    assert data4.get('confidence') == 88.0
    assert data4.get('geojson') is not None
    assert data4.get('urls') is not None
    assert 'original' in data4['urls'] and 'overlay' in data4['urls']
    feature0 = data4['geojson']['features'][0]
    assert feature0['properties']['source'] == 'SAR_ANALYSIS'
    assert feature0['properties']['confidence'] == 88.0

# Test 5: Invalid bounds (north < south)
with open('test_input_gray.png', 'rb') as f:
    resp5 = client.post("/api/analyze-sar", 
        files={"file": ("test_input_gray.png", f, "image/png")},
        data={
            "north_lat": 19.0,
            "south_lat": 19.5,
            "west_lon": 70.5,
            "east_lon": 71.5
        }
    )

print("\nTEST 5: Invalid bounds (north < south)")
print(f"Status: {resp5.status_code}")
assert resp5.status_code == 400
print(f"Response: {resp5.text}")

print("\nALL AUTOMATED API TESTS PASSED SUCCESSFULLY!")

