// src/content/matchFinder/walmartSearch.ts - Walmart search results page extraction

import { ProductMatchResult } from '../../types';

/**
 * Find all product elements on a Walmart search page
 * 
 * @returns Array of DOM elements representing search results
 */
export function findWalmartSearchResultElements(): Element[] {
  try {
    // Try multiple selectors as Walmart's DOM structure can vary
    const selectors = [
      '[data-item-id]', // Product with item ID
      '[data-product-id]', // Product with product ID
      '.search-result-gridview-item', // Grid view item
      '.product.product-search-result.search-result-gridview-item', // Old style grid view
      '.sans-serif.relative.pb3.pt2.ph3.w-100' // Common product container
    ];
    
    for (const selector of selectors) {
      const results = document.querySelectorAll(selector);
      if (results.length > 0) {
        console.log(`[E-commerce Arbitrage] Found ${results.length} Walmart search results using selector: ${selector}`);
        return Array.from(results);
      }
    }
    
    console.warn('[E-commerce Arbitrage] No Walmart search results found on page');
    return [];
  } catch (error) {
    console.error('[E-commerce Arbitrage] Error finding Walmart search results:', error);
    return [];
  }
}

/**
 * Extract a product from a Walmart search result element
 * 
 * @param element - The search result DOM element
 * @returns Extracted product match data
 */
export function extractWalmartSearchResult(element: Element): Partial<ProductMatchResult> | null {
  try {
    // Extract title
    const titleElement = element.querySelector('[data-automation-id="product-title"], .sans-serif.mid-gray, .w_iUH, .lh-title');
    const title = titleElement?.textContent?.trim() || '';
    
    if (!title) {
      console.log('[E-commerce Arbitrage] No title found in Walmart search result');
      return null;
    }
    
    // Extract price - Walmart often has more complex price structures
    const priceElement = element.querySelector('[data-automation-id="product-price"], .b.black.f1.mr1, .w_iUH');
    let price: number | null = null;
    
    if (priceElement) {
      const priceText = priceElement.textContent || '';
      console.log('[E-commerce Arbitrage] Raw Walmart price text:', priceText);
      
      // Look for "current price $XX.XX" format
      if (priceText.includes('current price')) {
        const matches = priceText.match(/current\s+price\s+\$?(\d+)\.?(\d{0,2})/i);
        if (matches) {
          const dollars = parseInt(matches[1], 10);
          // If no decimal part is found, default to 0 cents
          const cents = matches[2] ? parseInt(matches[2].padEnd(2, '0'), 10) : 0;
          price = dollars + (cents / 100);
          console.log(`[E-commerce Arbitrage] Parsed Walmart price: $${dollars}.${cents} = ${price}`);
        }
      } else {
        // Try standard price format with regex that handles both $XX and $XX.XX
        const priceMatch = priceText.match(/\$?(\d+)(?:\.(\d{1,2}))?/);
        if (priceMatch) {
          const dollars = parseInt(priceMatch[1], 10);
          const cents = priceMatch[2] ? parseInt(priceMatch[2].padEnd(2, '0'), 10) : 0;
          price = dollars + (cents / 100);
          console.log(`[E-commerce Arbitrage] Parsed Walmart price: $${dollars}.${cents} = ${price}`);
        }
      }
    }
    
    if (price === null || isNaN(price)) {
      // Try alternative price formats
      // Walmart sometimes separates dollars and cents
      const wholeDollarElement = element.querySelector('.w_C6.w_D.w_C7.w_Da');
      const centsElement = element.querySelector('.w_C6.w_D.w_C7.w_Db');
      
      if (wholeDollarElement && centsElement) {
        const dollars = wholeDollarElement.textContent?.replace(/[^\d]/g, '') || '0';
        const cents = centsElement.textContent?.replace(/[^\d]/g, '') || '00';
        price = parseFloat(`${dollars}.${cents}`);
        console.log(`[E-commerce Arbitrage] Parsed Walmart split price: $${dollars}.${cents} = ${price}`);
      }
    }
    
    if (price === null || isNaN(price)) {
      console.log('[E-commerce Arbitrage] No valid price found in Walmart search result');
      return null;
    }
    
    // Get URL
    const linkElement = element.querySelector('a[link-identifier="linkTest"], a.absolute.w-100.h-100, .sans-serif.w_iUH a');
    const relativeUrl = linkElement ? linkElement.getAttribute('href') || '' : '';
    const url = relativeUrl ? new URL(relativeUrl, window.location.origin).href : '';
    
    if (!url) {
      console.log('[E-commerce Arbitrage] No URL found in Walmart search result');
      return null;
    }
    
    // Extract product ID
    let productId: string | undefined = undefined;
    if (url) {
      // Try multiple patterns that appear in Walmart URLs
      const idPatterns = [
        /\/ip\/(?:.*?)\/(\d+)/, // /ip/Title-Here/12345
        /\/ip\/(\d+)/, // /ip/12345
        /\/(\d+)(?:\?|\&|$)/ // /12345 or /12345?param
      ];
      
      for (const pattern of idPatterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
          productId = match[1];
          break;
        }
      }
      
      // Also check data attributes
      if (!productId) {
        productId = element.getAttribute('data-item-id') || 
                   element.getAttribute('data-product-id') || undefined;
      }
    }
    
    // Get image
    const imgElement = element.querySelector('img[data-automation-id="product-image"], img.absolute, img.w_iUF');
    const imageUrl = imgElement ? imgElement.getAttribute('src') || undefined : undefined;
    
    // Get ratings
    const ratingElement = element.querySelector('.stars-container, [data-automation-id="product-stars"]');
    let rating: number | null = null;
    
    if (ratingElement) {
      // Walmart often uses "width" percentage in a stars container to represent rating
      const styleWidth = ratingElement.getAttribute('style');
      if (styleWidth && styleWidth.includes('width')) {
        const widthMatch = styleWidth.match(/width:?\s*(\d+(?:\.\d+)?)%/);
        if (widthMatch && widthMatch[1]) {
          // Convert percentage to a 5-star rating (100% = 5 stars)
          rating = (parseFloat(widthMatch[1]) / 100) * 5;
        }
      } else {
        // Try to get the text rating
        const ratingText = ratingElement.textContent || '';
        const ratingMatch = ratingText.match(/(\d+(?:\.\d+)?)/);
        if (ratingMatch && ratingMatch[1]) {
          rating = parseFloat(ratingMatch[1]);
        }
      }
    }
    
    // Get review count
    const reviewCountElement = element.querySelector('.stars-reviews-count, [data-automation-id="product-reviews"]');
    let reviewCount: number | null = null;
    
    if (reviewCountElement) {
      const countText = reviewCountElement.textContent || '';
      const countMatch = countText.match(/(\d+(?:,\d+)*)/);
      if (countMatch && countMatch[1]) {
        reviewCount = parseInt(countMatch[1].replace(/,/g, ''), 10);
      }
    }
    
    return {
      title,
      price,
      image: imageUrl,
      url,
      marketplace: 'walmart',
      item_id: productId,
      ratings: {
        average: rating,
        count: reviewCount
      }
    };
  } catch (error) {
    console.error('[E-commerce Arbitrage] Error extracting Walmart search result:', error);
    return null;
  }
}

/**
 * Calculate similarity between two product titles
 * Used for comparing source product with potential matches
 * 
 * @param title1 - First product title
 * @param title2 - Second product title
 * @returns Similarity score between 0 and 1
 */
export function calculateWalmartTitleSimilarity(title1: string, title2: string): number {
  if (!title1 || !title2) return 0;
  
  // Normalize strings
  const normalize = (str: string) => str.toLowerCase().replace(/[^\w\s]/g, '');
  
  const normalizedTitle1 = normalize(title1);
  const normalizedTitle2 = normalize(title2);
  
  // Get words from titles (filter out very short words)
  const words1 = normalizedTitle1.split(/\s+/).filter(w => w.length > 2);
  const words2 = normalizedTitle2.split(/\s+/).filter(w => w.length > 2);
  
  // Count matching words
  let matchCount = 0;
  for (const word1 of words1) {
    if (words2.some(word2 => word2.includes(word1) || word1.includes(word2))) {
      matchCount++;
    }
  }
  
  // Calculate similarity score (0-1)
  return matchCount / Math.max(words1.length, words2.length);
}
