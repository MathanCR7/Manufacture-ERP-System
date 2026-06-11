const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BASE_URL = 'https://hsnlookup.com';
const TARGET_PATH = path.join(__dirname, '../src/database/hsn_codes.json');

async function downloadHsnCodes() {
  try {
    console.log(`[1/5] Fetching homepage from ${BASE_URL}...`);
    const homeResponse = await axios.get(BASE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    
    // Find the main index.js script
    const indexJsRegex = /src="(\/assets\/index-[a-zA-Z0-9_-]+\.js)"/;
    const indexJsMatch = homeResponse.data.match(indexJsRegex);
    if (!indexJsMatch) {
      throw new Error('Could not find main index.js script on the homepage.');
    }
    
    const indexJsUrl = `${BASE_URL}${indexJsMatch[1]}`;
    console.log(`[2/5] Found main script: ${indexJsUrl}`);
    console.log(`      Fetching main script...`);
    const indexJsResponse = await axios.get(indexJsUrl);
    
    // Find the data-[hash].js script in the dependency map
    const dataJsRegex = /"assets\/data-([a-zA-Z0-9_-]+)\.js"/;
    const dataJsMatch = indexJsResponse.data.match(dataJsRegex);
    if (!dataJsMatch) {
      throw new Error('Could not find data.js file in index.js dependency map.');
    }
    
    const dataJsUrl = `${BASE_URL}/${dataJsMatch[0].replace(/"/g, '')}`;
    console.log(`[3/5] Found data script: ${dataJsUrl}`);
    console.log(`      Fetching data script...`);
    const dataJsResponse = await axios.get(dataJsUrl);
    const dataJsContent = dataJsResponse.data;
    
    console.log(`[4/5] Parsing database script (Length: ${dataJsContent.length} chars)...`);
    
    const startIndex = dataJsContent.indexOf('[');
    if (startIndex === -1) {
      throw new Error('Could not find starting bracket [ in data script.');
    }
    
    let bracketCount = 0;
    let endIndex = -1;
    let inString = null;
    let escaped = false;
    
    for (let i = startIndex; i < dataJsContent.length; i++) {
      const char = dataJsContent[i];
      
      if (escaped) {
        escaped = false;
        continue;
      }
      
      if (char === '\\') {
        escaped = true;
        continue;
      }
      
      if (inString) {
        if (char === inString) {
          inString = null;
        }
        continue;
      }
      
      if (char === '"' || char === "'" || char === '`') {
        inString = char;
        continue;
      }
      
      if (char === '[') {
        bracketCount++;
      } else if (char === ']') {
        bracketCount--;
        if (bracketCount === 0) {
          endIndex = i;
          break;
        }
      }
    }
    
    if (endIndex === -1) {
      throw new Error('Could not find matching closing bracket ] for the HSN array.');
    }
    
    const arrayStr = dataJsContent.substring(startIndex, endIndex + 1);
    console.log('      Evaluating HSN array literal...');
    let hsnList = null;
    try {
      hsnList = new Function(`return ${arrayStr};`)();
    } catch (evalErr) {
      throw new Error(`Failed to evaluate JS array: ${evalErr.message}`);
    }
    
    if (!Array.isArray(hsnList)) {
      throw new Error('Parsed data is not an array.');
    }
    
    console.log(`      Successfully extracted ${hsnList.length} HSN records!`);
    
    console.log(`[5/5] Saving compiled catalog to: ${TARGET_PATH}`);
    // Create directory if it doesn't exist
    const dir = path.dirname(TARGET_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(TARGET_PATH, JSON.stringify(hsnList, null, 2), 'utf8');
    console.log('SUCCESS: Complete HSN database has been downloaded and compiled!');
    
  } catch (error) {
    console.error('ERROR: Failed to download HSN codes:', error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
    }
    process.exit(1);
  }
}

downloadHsnCodes();
