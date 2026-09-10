import torch
import numpy as np
import cv2
from PIL import Image

# Define class mappings and colors
# 0 = Sea
# 1 = Oil spill
# 2 = Look-alike
# 3 = Ship
# 4 = Land

CLASS_NAMES = {
    0: "sea",
    1: "oil",
    2: "lookalike",
    3: "ship",
    4: "land"
}

CLASS_COLORS = {
    0: (0, 0, 0, 0),         # Sea (transparent)
    1: (0, 255, 255, 150),   # Oil (Cyan, semi-transparent)
    2: (255, 215, 0, 150),   # Look-alike (Gold, semi-transparent)
    3: (255, 0, 0, 200),     # Ship (Red, distinct)
    4: (34, 139, 34, 150)    # Land (Forest Green, semi-transparent)
}

def postprocess_output(output_tensor: torch.Tensor, original_image: Image.Image, geo_bounds: dict = None):
    """
    Takes the raw output tensor from the model and the original PIL image.
    geo_bounds format: {"north": float, "south": float, "east": float, "west": float}
    Returns:
      - pixel counts for each class
      - oil region count
      - max region pixels
      - average confidence
      - GeoJSON dictionary (if geo_bounds is present, else None)
      - an overlay image (PIL Image)
    """
    probs = torch.nn.functional.softmax(output_tensor, dim=1)
    max_probs, preds = torch.max(probs, dim=1)
    
    pred_mask = preds[0].cpu().numpy()
    conf_mask = max_probs[0].cpu().numpy()
    
    orig_w, orig_h = original_image.size
    pred_mask_img = Image.fromarray(pred_mask.astype(np.uint8), mode='L')
    pred_mask_resized = pred_mask_img.resize((orig_w, orig_h), resample=Image.NEAREST)
    pred_array = np.array(pred_mask_resized)
    
    counts = {name: 0 for name in CLASS_NAMES.values()}
    unique, class_counts = np.unique(pred_array, return_counts=True)
    for cls_idx, count in zip(unique, class_counts):
        if cls_idx in CLASS_NAMES:
            counts[CLASS_NAMES[cls_idx]] = int(count)
            
    oil_regions = 0
    max_oil_pixels = 0
    geojson_data = None
    
    if counts['oil'] > 0:
        # Create binary mask for oil
        oil_mask = (pred_array == 1).astype(np.uint8)
        
        # Morphological cleanup (remove tiny noise)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        oil_mask = cv2.morphologyEx(oil_mask, cv2.MORPH_OPEN, kernel, iterations=1)
        
        # Find contours
        contours, _ = cv2.findContours(oil_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        valid_contours = []
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area > 10:  # Ignore tiny noise regions (<10 pixels)
                valid_contours.append(cnt)
                max_oil_pixels = max(max_oil_pixels, int(area))
                
        oil_regions = len(valid_contours)
        
        conf_img = Image.fromarray(conf_mask, mode='F')
        conf_resized = np.array(conf_img.resize((orig_w, orig_h), resample=Image.BILINEAR))
        
        # Calculate confidence over the cleaned mask
        if oil_regions > 0:
            avg_confidence = float(np.mean(conf_resized[oil_mask == 1]))
        else:
            avg_confidence = float(np.mean(conf_mask))
            
        # Build GeoJSON if bounds exist
        if geo_bounds and oil_regions > 0:
            north, south, east, west = geo_bounds['north'], geo_bounds['south'], geo_bounds['east'], geo_bounds['west']
            
            def px_to_geo(x, y):
                # x is col (0 to orig_w), y is row (0 to orig_h)
                # Map x to [west, east], y to [north, south]
                lon = west + (x / orig_w) * (east - west)
                lat = north - (y / orig_h) * (north - south)
                return [float(lon), float(lat)]
            
            features = []
            for cnt in valid_contours:
                # simplify contour to reduce point count
                epsilon = 0.005 * cv2.arcLength(cnt, True)
                approx = cv2.approxPolyDP(cnt, epsilon, True)
                
                # need at least 3 points for a polygon
                if len(approx) < 3:
                    continue
                    
                poly_coords = []
                for pt in approx:
                    x, y = pt[0]
                    poly_coords.append(px_to_geo(x, y))
                    
                # Close the polygon
                poly_coords.append(poly_coords[0])
                
                feature = {
                    "type": "Feature",
                    "properties": {
                        "class": "oil",
                        "source": "POSEatSea",
                        "confidence": avg_confidence,
                        "pixel_count": int(cv2.contourArea(cnt)),
                        "pixel_percentage": (float(cv2.contourArea(cnt)) / (orig_w * orig_h)) * 100.0
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [poly_coords]
                    }
                }
                features.append(feature)
                
            geojson_data = {
                "type": "FeatureCollection",
                "features": features
            }
    else:
        avg_confidence = float(np.mean(conf_mask))

    # Create overlay
    overlay = Image.new('RGBA', (orig_w, orig_h), (0, 0, 0, 0))
    overlay_data = np.zeros((orig_h, orig_w, 4), dtype=np.uint8)
    
    for cls_idx, color in CLASS_COLORS.items():
        if cls_idx == 0: continue # Skip sea
        mask = (pred_array == cls_idx)
        overlay_data[mask] = color
        
    overlay_img = Image.fromarray(overlay_data, mode='RGBA')
    
    if original_image.mode != 'RGBA':
        original_image = original_image.convert('RGBA')
        
    blended = Image.alpha_composite(original_image, overlay_img)
    
    return counts, oil_regions, max_oil_pixels, avg_confidence, geojson_data, blended
