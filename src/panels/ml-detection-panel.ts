import { delay } from '../utils/animation-utils.js';
import { analyzeSARImage } from '../api/api.js';

export function renderMLDetectionPanel(): string {
  return `
    <div class="ml-panel-container anim-fade-in">
      <div class="ml-header">
        <div class="card-title">AI SAR ANALYSIS</div>
        <div class="card-subtitle">AI IMAGE CLASSIFICATION</div>
      </div>
      
      <div class="sar-upload-section" style="margin-top: 16px; margin-bottom: 24px;">
        <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">Upload SAR Image:</div>
        
        <div id="upload-drop-zone" style="border: 2px dashed var(--primary-main); border-radius: 8px; padding: 24px; text-align: center; cursor: pointer; transition: all 0.3s; background: rgba(0, 229, 255, 0.05);">
          <input type="file" id="sar-file-input" accept=".png, .jpg, .jpeg" style="display: none;" />
          <svg style="width: 32px; height: 32px; color: var(--primary-main); margin-bottom: 12px;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <div style="color: var(--text-primary); font-weight: var(--fw-medium); margin-bottom: 4px;">Drag and drop or click to Browse</div>
          <div style="color: var(--text-secondary); font-size: 11px;">PNG, JPG, JPEG (Max 10MB)</div>
        </div>

        <div id="upload-preview-container" style="display: none; border: 1px solid var(--primary-main); border-radius: 8px; overflow: hidden; position: relative;">
          <img id="upload-preview-img" style="width: 100%; max-height: 150px; object-fit: cover; display: block;" />
          <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.7); padding: 8px; display: flex; justify-content: space-between; align-items: center;">
            <span id="upload-filename" style="font-size: 12px; color: #fff; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 70%;"></span>
            <button id="btn-remove-image" style="background: none; border: none; color: #ff5252; cursor: pointer; font-size: 12px; font-weight: bold;">Replace</button>
          </div>
        </div>
        
        <div id="upload-error" style="display: none; color: #ff5252; font-size: 12px; margin-top: 8px;"></div>
      </div>

      <div class="ml-visualization" id="ml-visualization" style="display: none;">
        <div class="ml-image-box">
          <div class="ml-image-title">RAW SAR IMAGE</div>
          <div class="ml-img-wrapper">
            <img src="" alt="Raw SAR" class="ml-img" id="ml-raw-img" />
          </div>
        </div>
        
        <div class="ml-process-arrow">
          <div id="ml-spinner" style="display:none;" class="ml-spinner"></div>
          <div id="ml-process-status" style="display:none; text-align: center;">Waiting</div>
        </div>

        <div class="ml-image-box">
          <div class="ml-image-title">AI SAR VALIDATION</div>
          <div class="ml-img-wrapper">
             <img src="" alt="Segmented SAR" class="ml-img" id="ml-img-result" style="display: none; width: 100%; height: 100%; object-fit: cover;"/>
          </div>
        </div>
      </div>

      <div class="ml-results anim-fade-in" id="ml-results" style="display: none; margin-top: 16px;">
        <div class="stat-row">
          <span class="stat-label">Evidence</span>
          <span class="stat-value" id="ml-res-output" style="font-weight:var(--fw-bold);"></span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Georeferencing</span>
          <span class="stat-value" id="ml-res-geo" style="font-size: 11px;"></span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Model Confidence</span>
          <span class="stat-value" id="ml-res-conf"></span>
        </div>
        
        <div style="margin-top: 16px; margin-bottom: 8px; font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Reasoning</div>
        <div id="ml-res-reasoning" style="font-size: 12px; color: var(--text-primary); line-height: 1.4; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 4px;"></div>

        <div style="margin-top: 16px; margin-bottom: 8px; font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Alternative Explanation</div>
        <div id="ml-res-alternative" style="font-size: 12px; color: var(--text-primary); line-height: 1.4; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 4px;"></div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px;">
            <div>
                <div style="margin-bottom: 8px; font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Oil Indicators</div>
                <ul id="ml-res-oil-indicators" style="font-size: 12px; color: var(--primary-main); padding-left: 16px; margin: 0; line-height: 1.4;"></ul>
            </div>
            <div>
                <div style="margin-bottom: 8px; font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Look-Alike Indicators</div>
                <ul id="ml-res-look-alike-indicators" style="font-size: 12px; color: #ffab00; padding-left: 16px; margin: 0; line-height: 1.4;"></ul>
            </div>
        </div>
        
        <div id="ml-res-warnings" style="margin-top: 16px; font-size: 11px; color: #ffab00; border-left: 2px solid #ffab00; padding-left: 8px;">
        </div>
        
        <div class="data-provenance" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1);">
          <div style="font-size: 11px; font-weight: bold; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase;">Data Provenance</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
            <div style="color: var(--text-secondary);">Satellite imagery:</div><div style="color: var(--primary-main);">USER-PROVIDED SAR IMAGE</div>
            <div style="color: var(--text-secondary);">Image Classification:</div><div style="color: var(--primary-main);">AI SAR ASSESSMENT</div>
            <div style="color: var(--text-secondary);">Environmental forcing:</div><div style="color: #ffab00;">SYNTHETIC DEMO DATA</div>
            <div style="color: var(--text-secondary);">AIS Source:</div><div style="color: #00e5ff;">LIVE AISSTREAM / FORENSIC</div>
            <div style="color: var(--text-secondary);">Drift:</div><div style="color: #ffab00;">PRECOMPUTED DEMO DATA</div>
          </div>
        </div>
      </div>

      <button class="btn btn-primary btn-block" id="btn-run-ml" style="margin-top:var(--space-2);" disabled>ANALYZE SAR</button>
    </div>
  `;
}

export function runMLSequence(container: HTMLElement): Promise<{ spillDetected: boolean; confidence: number; areaKm2: number; geojson: any; imageUrl?: string; bounds?: any }> {
  return new Promise((resolve) => {
    const btn = container.querySelector('#btn-run-ml') as HTMLButtonElement;
    
    // Upload UI
    const dropZone = container.querySelector('#upload-drop-zone') as HTMLElement;
    const fileInput = container.querySelector('#sar-file-input') as HTMLInputElement;
    const previewContainer = container.querySelector('#upload-preview-container') as HTMLElement;
    const previewImg = container.querySelector('#upload-preview-img') as HTMLImageElement;
    const filenameLabel = container.querySelector('#upload-filename') as HTMLElement;
    const btnRemove = container.querySelector('#btn-remove-image') as HTMLButtonElement;
    const errorLabel = container.querySelector('#upload-error') as HTMLElement;
    
    // Geo Bounds UI (Removed)
    
    // Vis UI
    const visualization = container.querySelector('#ml-visualization') as HTMLElement;
    const status = container.querySelector('#ml-process-status') as HTMLElement;
    const spinner = container.querySelector('#ml-spinner') as HTMLElement;
    const imgResult = container.querySelector('#ml-img-result') as HTMLImageElement;
    const rawImg = container.querySelector('#ml-raw-img') as HTMLImageElement;
    
    // Results UI
    const results = container.querySelector('#ml-results') as HTMLElement;
    const resOutput = container.querySelector('#ml-res-output') as HTMLElement;
    const resGeo = container.querySelector('#ml-res-geo') as HTMLElement;
    const resConf = container.querySelector('#ml-res-conf') as HTMLElement;
    const resReasoning = container.querySelector('#ml-res-reasoning') as HTMLElement;
    const resAlternative = container.querySelector('#ml-res-alternative') as HTMLElement;
    const resOilIndicators = container.querySelector('#ml-res-oil-indicators') as HTMLElement;
    const resLookAlikeIndicators = container.querySelector('#ml-res-look-alike-indicators') as HTMLElement;
    const resWarnings = container.querySelector('#ml-res-warnings') as HTMLElement;
    
    let selectedFile: File | null = null;

    // --- Upload Logic ---
    const handleFile = (file: File) => {
      errorLabel.style.display = 'none';
      if (!file.type.startsWith('image/')) {
        showError('Please upload a valid image file (PNG, JPG).');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showError('File is too large. Max 10MB.');
        return;
      }
      
      selectedFile = file;
      filenameLabel.textContent = file.name;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        previewImg.src = e.target?.result as string;
        dropZone.style.display = 'none';
        previewContainer.style.display = 'block';
        btn.disabled = false;
      };
      reader.readAsDataURL(file);
    };

    const showError = (msg: string) => {
      errorLabel.textContent = msg;
      errorLabel.style.display = 'block';
      resetFile();
    };

    const resetFile = () => {
      selectedFile = null;
      fileInput.value = '';
      dropZone.style.display = 'block';
      previewContainer.style.display = 'none';
      btn.disabled = true;
    };

    dropZone.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.backgroundColor = 'rgba(0, 229, 255, 0.15)';
    });
    
    dropZone.addEventListener('dragleave', () => {
      dropZone.style.backgroundColor = 'rgba(0, 229, 255, 0.05)';
    });
    
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.backgroundColor = 'rgba(0, 229, 255, 0.05)';
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (fileInput.files && fileInput.files.length > 0) {
        handleFile(fileInput.files[0]);
      }
    });

    btnRemove.addEventListener('click', resetFile);

    // --- Inference Logic ---
    btn.addEventListener('click', async () => {
      if (!selectedFile) return;
      
      // Use synthetic case001 bounds automatically for demo
      const bounds = {
        north: 19.4674,
        south: 19.3400,
        east: 71.3090,
        west: 71.1895
      };
      
      // Hide upload section to save space
      const uploadSection = container.querySelector('.sar-upload-section') as HTMLElement;
      uploadSection.style.display = 'none';
      
      // Show visualization area
      visualization.style.display = 'block';
      rawImg.src = previewImg.src; // Show selected image in the RAW box
      
      btn.disabled = true;
      btn.textContent = 'ANALYZING...';
      spinner.style.display = 'block';
      status.style.display = 'block';
      
      status.textContent = 'INGESTING SAR IMAGE';
      
      try {
        status.textContent = 'RUNNING AI SEGMENTATION';
        const result = await analyzeSARImage(selectedFile, bounds);
        
        status.textContent = 'ANALYZING RESULT';
        await delay(500); // Slight delay for UX
        
        status.textContent = 'COMPLETE';
        spinner.style.display = 'none';
        btn.style.display = 'none';

        // Show segmentation result if available
        if (result.urls && result.urls.overlay) {
          imgResult.src = result.urls.overlay;
          imgResult.style.display = 'block';
        } else {
          imgResult.style.display = 'none';
        }
        
        const classification = result.classification || (result.gemini_result ? result.gemini_result.classification : "UNCERTAIN");
        const gemini = result.gemini_result;
        const conf = gemini ? Number(gemini.confidence) : 0;

        const isInvestigationEligible = (geminiResult: any): boolean => {
          if (!geminiResult) return false;
          return geminiResult.classification === "OIL_SPILL" && Number(geminiResult.confidence) > 70;
        };
        const oilDetected = isInvestigationEligible(gemini);

        if (oilDetected) {
          resOutput.textContent = 'INVESTIGATION ELIGIBLE (' + classification + ')';
          resOutput.style.color = 'var(--primary-main)';
        } else {
          resOutput.textContent = 'CASE ABORTED (' + classification + ')';
          resOutput.style.color = '#ffb300';
        }

        if (result.georeferenced && oilDetected) {
          resGeo.textContent = 'SUCCESS (GeoJSON Generated)';
          resGeo.style.color = 'var(--primary-main)';
        } else if (!oilDetected) {
           resGeo.textContent = 'N/A';
           resGeo.style.color = 'var(--text-secondary)';
        } else {
          resGeo.textContent = 'NO GEOGRAPHIC BOUNDS PROVIDED';
          resGeo.style.color = '#ffab00';
        }
        
        resConf.textContent = conf + '%';
        
        if (gemini) {
          resReasoning.textContent = gemini.reasoning || "No reasoning provided.";
          
          if (resAlternative) resAlternative.textContent = gemini.alternative_explanation || "None provided.";
          
          if (resOilIndicators) {
            resOilIndicators.innerHTML = '';
            if (gemini.oil_indicators && Array.isArray(gemini.oil_indicators)) {
               gemini.oil_indicators.forEach((ind: string) => {
                  const li = document.createElement('li');
                  li.textContent = ind;
                  resOilIndicators.appendChild(li);
               });
            }
          }

          if (resLookAlikeIndicators) {
            resLookAlikeIndicators.innerHTML = '';
            if (gemini.look_alike_indicators && Array.isArray(gemini.look_alike_indicators)) {
               gemini.look_alike_indicators.forEach((ind: string) => {
                  const li = document.createElement('li');
                  li.textContent = ind;
                  resLookAlikeIndicators.appendChild(li);
               });
            }
          }
          
          resWarnings.innerHTML = '';
          if (gemini.warnings && Array.isArray(gemini.warnings)) {
             gemini.warnings.forEach((warn: string) => {
                const div = document.createElement('div');
                div.textContent = '⚠ ' + warn;
                div.style.marginBottom = '4px';
                resWarnings.appendChild(div);
             });
          }
        }

        results.style.display = 'block';

        await delay(1000);

        const imageUrl = URL.createObjectURL(selectedFile);
        resolve({
          spillDetected: oilDetected,
          confidence: conf,
          classification: classification,
          gemini: gemini,
          geojson: result.geojson,
          imageUrl: imageUrl,
          bounds: bounds
        });

      } catch (err) {
        // Handle API Error
        spinner.style.display = 'none';
        status.textContent = 'ERROR';
        status.style.color = '#ff5252';
        
        uploadSection.style.display = 'block'; // Show upload again
        visualization.style.display = 'none'; // Hide viz
        
        showError(err instanceof Error ? err.message : 'Analysis failed due to server error.');
        btn.textContent = 'ANALYZE SAR';
        btn.disabled = false;
        
        // We don't resolve the promise here so the user can try again
      }
    }, { once: false }); // Allow retries
  });
}
