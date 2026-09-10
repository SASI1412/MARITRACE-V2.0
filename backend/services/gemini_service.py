import os
import json
import google.generativeai as genai
from PIL import Image

def analyze_image_with_gemini(image: Image.Image):
    """
    Analyzes the SAR image using Gemini Vision to classify it as OIL_SPILL, LOOK_ALIKE, 
    NO_SIGNIFICANT_OIL, or UNCERTAIN.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {
            "classification": "UNCERTAIN", 
            "confidence": 0, 
            "reasoning": "Missing API Key configuration in backend environment.",
            "oil_indicators": [],
            "look_alike_indicators": [],
            "alternative_explanation": "",
            "visual_indicators": [],
            "warnings": ["AI image classification service is not configured."]
        }
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-3.6-flash')
    
    prompt = """
    You are an expert maritime SAR image analyst assisting a forensic oil-spill investigation.
    The uploaded image is SAR/radar imagery of a maritime environment.
    Your task is NOT to assume that a dark region is oil.
    Dark SAR anomalies can be caused by many look-alikes, including:
    - low-wind / wind-shadow areas
    - natural ocean slicks
    - biogenic surface films
    - rain cells
    - calm-water regions
    - ship wakes
    - internal waves
    - radar acquisition artifacts
    - speckle / processing artifacts
    - shoreline or land contamination
    - shadows
    - image compression artifacts
    - other non-oil dark structures

    You MUST actively attempt to disprove the oil-spill hypothesis before classifying an image as OIL_SPILL.
    Do NOT classify an image as OIL_SPILL merely because it contains a dark region.

    First inspect:
    1. Overall SAR scene context
    2. Shape and morphology of dark anomalies
    3. Spatial continuity
    4. Texture
    5. Contrast relative to surrounding water
    6. Whether the anomaly appears physically plausible as a surface slick
    7. Whether it resembles known SAR look-alikes
    8. Whether there are multiple independent visual indicators supporting oil
    9. Whether the image contains sufficient evidence to make a reliable decision

    Then compare:
    OIL_SPILL hypothesis versus LOOK_ALIKE hypothesis

    If a dark feature could reasonably be explained by a look-alike, DO NOT automatically call it oil.
    Be conservative. When evidence is ambiguous, return UNCERTAIN rather than OIL_SPILL.

    Return exactly ONE classification:
    OIL_SPILL, LOOK_ALIKE, NO_SIGNIFICANT_OIL, UNCERTAIN

    Definitions:
    OIL_SPILL: Visually coherent maritime dark anomaly with multiple characteristics consistent with an oil slick. Evidence favors oil over common look-alikes.
    LOOK_ALIKE: A dark maritime anomaly exists, but its morphology/context is more consistent with a known non-oil phenomenon.
    NO_SIGNIFICANT_OIL: No convincing oil-like maritime anomaly is visible.
    UNCERTAIN: Image quality or evidence is insufficient to confidently distinguish oil from a look-alike.

    Confidence: Return 0-100. Must represent confidence in the CLASSIFICATION, not merely that an anomaly exists. Decrease when look-alike explanations remain plausible.

    Return ONLY valid JSON:
    {
      "classification": "OIL_SPILL",
      "confidence": 87,
      "reasoning": "Concise explanation of why the classification was selected.",
      "oil_indicators": ["..."],
      "look_alike_indicators": ["..."],
      "alternative_explanation": "...",
      "visual_indicators": ["..."],
      "warnings": ["AI image classification is an evidence-supporting signal, not legal proof."]
    }
    """
    try:
        response = model.generate_content(
            [prompt, image],
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.1
            )
        )
        text_response = response.text
        
        # Cleanup potential markdown json blocks just in case
        if text_response.startswith("```json"):
            text_response = text_response[7:]
        if text_response.endswith("```"):
            text_response = text_response[:-3]
            
        parsed_json = json.loads(text_response.strip())
        
        # Validation
        valid_classes = ["OIL_SPILL", "LOOK_ALIKE", "NO_SIGNIFICANT_OIL", "UNCERTAIN"]
        if parsed_json.get("classification") not in valid_classes:
            parsed_json["classification"] = "UNCERTAIN"

        try:
            conf = float(parsed_json.get("confidence", 0))
            if conf < 0 or conf > 100:
                raise ValueError("Confidence out of range")
            parsed_json["confidence"] = conf
        except (ValueError, TypeError):
            parsed_json["classification"] = "UNCERTAIN"
            parsed_json["confidence"] = 0

        parsed_json.setdefault("oil_indicators", [])
        parsed_json.setdefault("look_alike_indicators", [])
        parsed_json.setdefault("alternative_explanation", "")
        parsed_json.setdefault("visual_indicators", [])
        parsed_json.setdefault("warnings", [])
        parsed_json.setdefault("reasoning", "")
        
        return parsed_json
    except Exception as e:
        return {
            "classification": "UNCERTAIN", 
            "confidence": 0, 
            "reasoning": f"AI SAR Analysis Error: {str(e)}",
            "oil_indicators": [],
            "look_alike_indicators": [],
            "alternative_explanation": "",
            "visual_indicators": [],
            "warnings": []
        }
