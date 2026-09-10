# MariTrace Backend

The backend of MariTrace is a FastAPI application that serves the POSEatSea semantic segmentation AI model for oil spill detection.

## Setup & Run

1. **Create and activate a virtual environment:**
   ```bash
   python -m venv venv
   source venv/Scripts/activate  # Windows
   # source venv/bin/activate    # Mac/Linux
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the server:**
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   The backend will be available at `http://localhost:8000`.

## Architecture
The backend is designed for rapid inference and geographic coordinate mapping:
- **`main.py`**: FastAPI entrypoint and request routing.
- **`inference/model.py`**: POSEatSea model architecture and ONNX loading (if applicable).
- **`inference/preprocess.py`**: SAR image normalization and tiling.
- **`inference/postprocess.py`**: Pixel mapping to geographic coordinates (GeoJSON generation).

## Data Notes
The inference engine is trained on Sentinel-1 SAR imagery. It classifies pixels into the following categories:
- **Class 1 (Oil):** Returns Cyan mask `(0, 255, 255, 150)`. Generates GeoJSON bounds for downstream drift calculation.
- **Class 2 (Look-alike):** Returns Gold mask `(255, 215, 0, 150)`. Aborts automated pipeline.
- **Class 3 (Ship):** Returns Red mask `(255, 0, 0, 200)`.
- **Class 4 (Land):** Returns Green mask `(34, 139, 34, 150)`.
