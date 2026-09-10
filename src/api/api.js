/**
 * Frontend API client for communicating with the FastAPI backend.
 */

export async function analyzeSARImage(file, bounds = null) {
  const formData = new FormData();
  formData.append('file', file);
  
  if (bounds) {
    formData.append('north_lat', bounds.north);
    formData.append('south_lat', bounds.south);
    formData.append('east_lon', bounds.east);
    formData.append('west_lon', bounds.west);
  }

  try {
    const response = await fetch('/api/analyze-sar', {
      method: 'POST',
      body: formData,
    });

    const contentType = response.headers.get("content-type") || "";
    let data;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMsg = data?.detail || data?.message || (typeof data === 'string' ? data : JSON.stringify(data)) || `HTTP ${response.status}`;
      throw new Error(`Analysis failed: ${errorMsg}`);
    }

    return data;
  } catch (error) {
    console.error('Error analyzing SAR image:', error);
    throw error;
  }
}
