# MariTrace — Maritime Forensic Investigation Platform

MariTrace is a professional maritime forensic investigation workstation designed to trace the origin of marine oil spills and attribute them to candidate vessels.

## Data Provenance Disclaimer
**⚠ Simulated data for demonstration only. Not for operational or legal use.**
- **Satellite Imagery:** User-provided or Curated SAR image.
- **Spill Segmentation:** AI Inference via POSEatSea pretrained model.
- **Environmental Forcing (Wind/Current):** Synthetic demo data.
- **AIS Data:** Curated demo data.
- **Drift Trajectories:** Precomputed demo data.

*MARITRACE provides an evidence-based compatibility ranking, not a legal determination of responsibility.*

## Architecture
- **Frontend:** Vanilla JS + MapLibre GL JS (WebGL-accelerated vector rendering)
- **Backend:** FastAPI (Python) for AI Inference
- **AI Engine:** PyTorch + ONNX (POSEatSea Semantic Segmentation)

## Running Locally

1. **Backend Setup**
   ```bash
   cd backend
   python -m venv venv
   source venv/Scripts/activate  # Windows
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```

2. **Frontend Setup**
   ```bash
   npm install
   npm run dev
   ```

## Hackathon Demo Procedure
1. Load the application. The 3D globe visualization will appear for 3 seconds before automatically fading into the GIS Workspace.
2. In the "Investigation" tab, click **"Investigate Spill"**.
3. Upload the provided SAR image (`.png` or `.jpg`).
4. Wait for the POSEatSea model to perform inference.
5. If an oil spill signature is detected, the workflow will automatically proceed through drift reconstruction, AIS correlation, and candidate ranking.
6. Press the "Continue Investigation" button to advance through the workflow phases.
7. To restart, click "Restart Investigation" or the "Replay" button in the header.
"# MARITRACE-V2.0" 
