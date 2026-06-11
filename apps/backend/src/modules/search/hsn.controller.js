const fs = require('fs');
const path = require('path');

const hsnCodesPath = path.join(__dirname, '../../database/hsn_codes.json');
let hsnList = [];

function loadHsnDatabase() {
  try {
    if (fs.existsSync(hsnCodesPath)) {
      hsnList = JSON.parse(fs.readFileSync(hsnCodesPath, 'utf8'));
      console.log(`[HSN Search] Loaded HSN Database: ${hsnList.length} codes ready.`);
    } else {
      console.warn(`[HSN Search] WARNING: HSN database not found at ${hsnCodesPath}. Please run the download script.`);
    }
  } catch (err) {
    console.error('[HSN Search] Failed to parse HSN codes database:', err);
  }
}

// Initial load
loadHsnDatabase();

/**
 * Searches HSN codes by code or description text
 */
const searchHsn = async (req, res, next) => {
  try {
    const { q, chapter, limit = 50 } = req.query;
    
    // Lazy reload if database was empty (e.g. script executed after boot)
    if (hsnList.length === 0) {
      loadHsnDatabase();
    }

    let results = hsnList;

    if (chapter) {
      results = results.filter(item => item.chapter === chapter);
    }

    if (q && q.trim().length > 0) {
      const query = q.trim().toLowerCase();
      const isDigits = /^\d+$/.test(query);

      if (isDigits) {
        // If query is numbers, search by HSN code prefix (e.g. "8471" matches computer codes)
        results = results.filter(item => item.hsn_code.startsWith(query));
      } else {
        const queryWords = query.split(/\s+/).filter(w => w.length > 0);
        
        // Filter: Keep items that have at least one query word in description, chapter_name, or keywords
        results = results.filter(item => {
          return queryWords.some(word => 
            item.description.toLowerCase().includes(word) ||
            (item.chapter_name && item.chapter_name.toLowerCase().includes(word)) ||
            (item.keywords && item.keywords.some(k => k.toLowerCase().includes(word)))
          );
        });

        // Score matches
        const getMatchScore = (item) => {
          const descLower = (item.description || '').toLowerCase();
          const descNormalized = descLower.replace(/[^a-z0-9\s]/g, ' ');
          const descWords = descNormalized.split(/\s+/).filter(w => w.length > 0);
          
          let score = 0;
          
          // 1. Exact description phrase match
          if (descLower.includes(query)) {
            score += 5000;
          } else if (descNormalized.includes(query)) {
            score += 4000;
          }
          
          // 2. Word matches in description
          let matchedDescWordsCount = 0;
          queryWords.forEach(qWord => {
            if (descWords.includes(qWord)) {
              score += 500;
              matchedDescWordsCount++;
            } else {
              // Partial prefix/stem match (e.g. "condition" in "conditioning")
              const hasPartial = descWords.some(dWord => {
                if (qWord.length >= 4 && dWord.length >= 4) {
                  const minLen = Math.min(qWord.length, dWord.length);
                  const prefixLen = Math.min(qWord.length, dWord.length, 4);
                  return qWord.substring(0, prefixLen) === dWord.substring(0, prefixLen);
                }
                return dWord.includes(qWord) || qWord.includes(dWord);
              });
              if (hasPartial) {
                score += 200;
                matchedDescWordsCount++;
              }
            }
          });
          
          // Bonus if all query words matched in the description
          if (matchedDescWordsCount === queryWords.length) {
            score += 2000;
          }
          
          // 3. Chapter Name Match
          const chapterLower = (item.chapter_name || '').toLowerCase();
          if (chapterLower.includes(query)) {
            score += 100;
          }
          
          // 4. Keyword Match (much lower weight to avoid pollution)
          if (item.keywords && item.keywords.length > 0) {
            let keywordExactMatches = 0;
            let keywordPartialMatches = 0;
            
            item.keywords.forEach(kw => {
              const kwLower = kw.toLowerCase();
              if (kwLower === query) {
                keywordExactMatches++;
              } else if (kwLower.includes(query)) {
                keywordPartialMatches++;
              }
            });
            
            score += keywordExactMatches * 10;
            score += keywordPartialMatches * 2;
          }
          
          return score;
        };

        // Score, filter positive scores, and sort descending
        results = results
          .map(item => ({ item, score: getMatchScore(item) }))
          .filter(r => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .map(r => r.item);
      }
    }

    res.json({
      success: true,
      total: results.length,
      results: results.slice(0, parseInt(limit, 10))
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieves the list of HSN chapters for catalog browsing
 */
const getChapters = async (req, res, next) => {
  try {
    if (hsnList.length === 0) {
      loadHsnDatabase();
    }

    const chaptersMap = new Map();
    hsnList.forEach(item => {
      if (item.chapter && !chaptersMap.has(item.chapter)) {
        chaptersMap.set(item.chapter, {
          chapter: item.chapter,
          chapter_name: item.chapter_name || 'General'
        });
      }
    });

    const chapters = Array.from(chaptersMap.values()).sort((a, b) => 
      a.chapter.localeCompare(b.chapter, undefined, { numeric: true })
    );

    res.json({
      success: true,
      chapters
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  searchHsn,
  getChapters
};
