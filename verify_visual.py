import matplotlib.pyplot as plt
import numpy as np
import json
import sys
from PIL import Image

sys.path.append('backend')
from fastapi.testclient import TestClient
from backend.main import app

# The bounding box we will test with
bounds = {
    'north_lat': 19.5,
    'south_lat': 19.0,
    'west_lon': 70.5,
    'east_lon': 71.5
}

img_path = 'synthetic_sar.png'
img = Image.open(img_path)
width, height = img.size

# Get API Response
client = TestClient(app)
with open(img_path, 'rb') as f:
    resp = client.post('/api/analyze-sar', files={'file': ('synthetic_sar.png', f, 'image/png')}, data=bounds)
    
data = resp.json()
geojson = data.get('geojson')
features = geojson.get('features', [])
largest = max(features, key=lambda x: x['properties'].get('pixel_count', 0))
poly_coords = largest['geometry']['coordinates'][0] # outer ring

# We want to map WGS84 back to pixel coordinates for plotting
def geo_to_pixel(lng, lat, w, h, bnds):
    # linear interpolation back to pixel
    x = (lng - bnds['west_lon']) / (bnds['east_lon'] - bnds['west_lon']) * w
    y = (bnds['north_lat'] - lat) / (bnds['north_lat'] - bnds['south_lat']) * h
    return x, y

pixels = [geo_to_pixel(lng, lat, width, height, bounds) for lng, lat in poly_coords]
x_coords = [p[0] for p in pixels]
y_coords = [p[1] for p in pixels]

# Calculate geometric centroid for visual
total_lng = sum(c[0] for c in poly_coords)
total_lat = sum(c[1] for c in poly_coords)
centroid_lng = total_lng / len(poly_coords)
centroid_lat = total_lat / len(poly_coords)

cx, cy = geo_to_pixel(centroid_lng, centroid_lat, width, height, bounds)

plt.figure(figsize=(10, 10))
plt.imshow(img)
plt.plot(x_coords, y_coords, color='#00e5ff', linewidth=3, label='AI GeoJSON Polygon')
plt.scatter([cx], [cy], color='red', s=100, marker='x', label='AI Centroid (Start of Drift)')

# Also draw backward drift vector approximation (delta -0.20 lat, +0.47 lng)
ox, oy = geo_to_pixel(centroid_lng + 0.47, centroid_lat - 0.20, width, height, bounds)
plt.plot([cx, ox], [cy, oy], color='white', linestyle='--', linewidth=2, label='Backward Drift Vector')
plt.scatter([ox], [oy], color='yellow', s=100, marker='o', label='Origin Zone Center')

plt.title('Phase 3A: SAR -> Segmentation -> GeoJSON -> Drift Origin')
plt.legend()
plt.axis('off')
plt.savefig('visual_verification.png', bbox_inches='tight')
print("Visual verification saved to visual_verification.png")
