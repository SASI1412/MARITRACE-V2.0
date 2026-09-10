import os
import sys
import json
import math
from PIL import Image

sys.path.append(os.path.abspath('backend'))
from fastapi.testclient import TestClient
from backend.main import app

# Load image to check dimensions
img_path = 'test_input.png'
img = Image.open(img_path)
width, height = img.size
print(f"1. Original SAR image dimensions: {width}x{height}")

client = TestClient(app)

with open(img_path, 'rb') as f:
    resp = client.post("/api/analyze-sar", 
        files={"file": ("test_input.png", f, "image/png")},
        data={
            "north_lat": 19.5,
            "south_lat": 19.0,
            "west_lon": 70.5,
            "east_lon": 71.5
        }
    )

if resp.status_code == 200:
    data = resp.json()
    geojson = data.get('geojson')
    
    print("\nAPI Response Metrics:")
    print(f"Oil Detected: {data.get('oil_detected')}")
    
    if geojson:
        # Assuming our postprocess.py calculated pixel counts/percentages somewhere, but if not we can see what's in properties
        features = geojson.get('features', [])
        
        total_pixels = 0
        total_percent = 0
        
        for f in features:
            props = f.get('properties', {})
            total_pixels += props.get('pixel_count', 0)
            total_percent += props.get('pixel_percentage', 0)
            
        print(f"2. Oil pixel count: {total_pixels}")
        print(f"3. Oil pixel percentage: {total_percent:.4f}%")
        print(f"4. Number of detected oil regions: {len(features)}")
        print(f"5. Number of GeoJSON features: {len(features)}")
        
        # Largest oil polygon
        if len(features) > 0:
            largest = max(features, key=lambda x: x['properties'].get('pixel_count', 0))
            poly_coords = largest['geometry']['coordinates']
            
            # Count vertices
            vertices_count = 0
            for ring in poly_coords:
                vertices_count += len(ring)
                
            # Calc bounds and centroid
            min_lng = 180
            max_lng = -180
            min_lat = 90
            max_lat = -90
            
            total_lng = 0
            total_lat = 0
            pt_count = 0
            
            for ring in poly_coords:
                for coord in ring:
                    lng, lat = coord
                    min_lng = min(min_lng, lng)
                    max_lng = max(max_lng, lng)
                    min_lat = min(min_lat, lat)
                    max_lat = max(max_lat, lat)
                    total_lng += lng
                    total_lat += lat
                    pt_count += 1
                    
            centroid_lng = total_lng / pt_count
            centroid_lat = total_lat / pt_count
            
            # Haversine width/height
            def haversine(lat1, lon1, lat2, lon2):
                R = 6371
                dLat = math.radians(lat2 - lat1)
                dLon = math.radians(lon2 - lon1)
                a = math.sin(dLat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon/2)**2
                c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
                return R * c
                
            width_km = haversine(centroid_lat, min_lng, centroid_lat, max_lng)
            height_km = haversine(min_lat, centroid_lng, max_lat, centroid_lng)
            
            print("\n6. Largest Oil Polygon:")
            print(f"   Vertices: {vertices_count}")
            print(f"   Min Longitude: {min_lng}")
            print(f"   Max Longitude: {max_lng}")
            print(f"   Min Latitude: {min_lat}")
            print(f"   Max Latitude: {max_lat}")
            print(f"   Calculated Centroid: ({centroid_lng}, {centroid_lat})")
            print(f"   Calculated Width: {width_km:.2f} km")
            print(f"   Calculated Height: {height_km:.2f} km")
            
            print("\n7. GeoJSON (Largest Feature):")
            print(json.dumps(largest, indent=2))
            
            print("\n8. Degenerate Polygon check:")
            distinct_vertices = vertices_count - len(poly_coords) # subtract closing points
            is_valid = distinct_vertices >= 3 and width_km > 0 and height_km > 0
            print(f"   Valid: {is_valid} (Distinct vertices: {distinct_vertices})")
            
            print("\n9. Coordinate ordering check:")
            first_coord = poly_coords[0][0]
            print(f"   Sample coordinate: {first_coord}")
            print(f"   Is Longitude first? (Should be around 70-71, Lat is ~19): {first_coord[0] > 70 and first_coord[1] < 20}")
    else:
        print("No GeoJSON returned.")
else:
    print(f"Error: {resp.status_code}")
    print(resp.text)
