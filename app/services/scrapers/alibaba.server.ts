/**
 * Alibaba Scraper
 * Extracts price and availability from Alibaba product pages
 * Note: Alibaba often shows price ranges (e.g. $5.00 - $10.00)
 * We extract the minimum price for cost calculation
 */

export interface ScrapeResult {
    price: number;
    isAvailable: boolean;
}

export async function parseAlibaba(html: string): Promise<ScrapeResult | null> {
    let price: number | null = null;
    let isAvailable = true;

    // Strategy 1: JSON-LD structured data
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
        for (const scriptBlock of jsonLdMatch) {
            try {
                const jsonContent = scriptBlock.replace(/<\/?script[^>]*>/gi, '');
                const data = JSON.parse(jsonContent);

                if (data['@type'] === 'Product' && data.offers) {
                    const offer = Array.isArray(data.offers) ? data.offers[0] : data.offers;
                    // Get low price from price range
                    if (offer.lowPrice) {
                        price = parseFloat(offer.lowPrice);
                    } else if (offer.price) {
                        price = parseFloat(offer.price);
                    }
                    if (offer.availability) {
                        isAvailable = !offer.availability.includes('OutOfStock');
                    }
                }
            } catch (e) {
                // JSON parsing failed, try next block
            }
        }
    }

    // Strategy 2: Alibaba-specific window object
    const windowDataMatch = html.match(/window\.detailData\s*=\s*({[\s\S]*?});/);
    if (!price && windowDataMatch) {
        try {
            const detailData = JSON.parse(windowDataMatch[1]);
            if (detailData.priceInfo?.minPrice) {
                price = parseFloat(detailData.priceInfo.minPrice);
            } else if (detailData.price) {
                price = parseFloat(detailData.price);
            }
            if (detailData.stock !== undefined) {
                isAvailable = detailData.stock > 0;
            }
        } catch (e) {
            // Failed to parse
        }
    }

    // Strategy 3: Look for price range in HTML
    if (!price) {
        // Alibaba shows "$5.00 - $10.00" or "US $5.00-$10.00"
        const priceRangePatterns = [
            /US\s*\$\s*([0-9.,]+)\s*-\s*\$\s*([0-9.,]+)/i,
            /\$\s*([0-9.,]+)\s*-\s*\$\s*([0-9.,]+)/,
            /data-min-price=["']([0-9.]+)["']/,
            /class=["'][^"']*price[^"']*["'][^>]*>[\s\S]*?\$([0-9.,]+)/i,
        ];

        for (const pattern of priceRangePatterns) {
            const match = html.match(pattern);
            if (match) {
                const priceStr = match[1].replace(/,/g, '');
                const parsed = parseFloat(priceStr);
                if (!isNaN(parsed)) {
                    price = parsed; // Use minimum price
                    break;
                }
            }
        }
    }

    // Strategy 4: Generic $ price regex (last resort)
    if (!price) {
        const genericPriceMatch = html.match(/\$\s*([0-9]+\.?[0-9]{0,2})\b/);
        if (genericPriceMatch) {
            price = parseFloat(genericPriceMatch[1]);
        }
    }

    // Check availability
    const oosPatterns = [
        /out of stock/i,
        /sold out/i,
        /currently unavailable/i,
        /no longer available/i,
        /contact supplier/i, // Alibaba-specific
    ];

    for (const pattern of oosPatterns) {
        if (pattern.test(html)) {
            isAvailable = false;
            break;
        }
    }

    if (price !== null && price > 0) {
        return { price, isAvailable };
    }

    return null;
}
