/**
 * DHgate Scraper
 * Extracts price and availability from DHgate product pages
 */

export interface ScrapeResult {
    price: number;
    isAvailable: boolean;
}

export async function parseDHgate(html: string): Promise<ScrapeResult | null> {
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
                    if (offer.price) {
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

    // Strategy 2: DHgate-specific window object
    // DHgate often uses window.runParams or similar
    const windowParamsMatch = html.match(/window\.productData\s*=\s*({[\s\S]*?});/);
    if (!price && windowParamsMatch) {
        try {
            const productData = JSON.parse(windowParamsMatch[1]);
            if (productData.price) {
                price = parseFloat(productData.price);
            }
            if (productData.stock !== undefined) {
                isAvailable = productData.stock > 0;
            }
        } catch (e) {
            // Failed to parse
        }
    }

    // Strategy 3: Look for price in common DHgate selectors
    if (!price) {
        // DHgate uses class="price" or data-price attributes
        const pricePatterns = [
            /data-price=["']([0-9.]+)["']/,
            /class=["'][^"']*price[^"']*["'][^>]*>[\s\S]*?\$([0-9.,]+)/i,
            /<span[^>]*itemPrice[^>]*>[\s\S]*?\$([0-9.,]+)/i,
        ];

        for (const pattern of pricePatterns) {
            const match = html.match(pattern);
            if (match) {
                const priceStr = match[1].replace(/,/g, '');
                const parsed = parseFloat(priceStr);
                if (!isNaN(parsed)) {
                    price = parsed;
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
