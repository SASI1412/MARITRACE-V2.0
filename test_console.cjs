const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('Navigating to http://localhost:3000');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  
  await page.evaluate(() => {
    if(window.map) {
      const origAddLayer = window.map.addLayer.bind(window.map);
      window.map.addLayer = function(layer, beforeId) {
        console.log('Intercepted addLayer:', layer.id);
        try {
          origAddLayer(layer, beforeId);
          console.log('Successfully added layer:', layer.id);
        } catch(e) {
          console.error('Error adding layer', layer.id, e);
        }
      };
      
      const origAddSource = window.map.addSource.bind(window.map);
      window.map.addSource = function(id, source) {
        console.log('Intercepted addSource:', id);
        try {
          origAddSource(id, source);
          console.log('Successfully added source:', id);
        } catch(e) {
          console.error('Error adding source', id, e);
        }
      };
    }
  });

  console.log('Clicking investigate...');
  await page.click('#btn-investigate');
  
  // Wait a bit, then click RUN ML DETECTION
  await new Promise(r => setTimeout(r, 2000));
  console.log('Clicking ML button...');
  await page.evaluate(() => {
    const btn = document.getElementById('btn-run-ml');
    if (btn) btn.click();
    else console.log('No ML button found');
  });

  // Wait 25 seconds for the whole pipeline to finish
  await new Promise(r => setTimeout(r, 25000));

  await browser.close();
})();
