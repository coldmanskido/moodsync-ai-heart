export interface ScrapeResult {
    price: number;
    isAvailable: boolean;
}

export async function parseAliExpress(html: string): Promise<ScrapeResult | null> {
    try {
        let price: number | null = null;
        let isAvailable = true; // Default to true unless proven otherwise

        // Method 1: Look for window.runParams (Classic AliExpress structure)
        const runParamsMatch = html.match(/window\.runParams\s*=\s*(\{.*?\});/);
        if (runParamsMatch && runParamsMatch[1]) {
            try {
                const data = JSON.parse(runParamsMatch[1]);
                const strData = JSON.stringify(data);

                // Price
                const priceMatch = strData.match(/"actSkuCalPrice"\s*:\s*"([\d\.]+)"/);
                if (priceMatch && priceMatch[1]) price = parseFloat(priceMatch[1]);

                // Stock (Simple heuristic on "inventory" or "skuQuantity")
                // If we find "skuQuantity":0, it might be OOS.
                // But safer is to look for JSON-LD which is explicit.
            } catch (e) { }
        }

        // Method 2: Regex Fallback for Price
        if (!price) {
            const formattedPriceRegex = /"formatedAmount"\s*:\s*"[^"]*?([\d\.]+)"/;
            const match2 = html.match(formattedPriceRegex);
            if (match2 && match2[1]) price = parseFloat(match2[1]);
        }

        // Method 3: JSON-LD Structured Data (Best for Availability too)
        const jsonLdRegex = /<script type="application\/ld\+json">(.*?)<\/script>/s;
        const jsonLdMatch = html.match(jsonLdRegex);
        if (jsonLdMatch && jsonLdMatch[1]) {
            try {
                const ldData = JSON.parse(jsonLdMatch[1]);

                // Price
                if (!price && (ldData.offers || ldData.lowPrice)) {
                    const foundPrice = ldData.offers?.price || ldData.lowPrice;
                    if (foundPrice) price = parseFloat(foundPrice);
                }

                // Availability
                // Schema.org uses "http://schema.org/InStock" or "http://schema.org/OutOfStock"
                if (ldData.offers?.availability) {
                    if (ldData.offers.availability.includes("OutOfStock")) {
                        isAvailable = false;
                    }
                }
            } catch (e) { }
        }

        // Final fallback for OOS text detection
        if (html.includes("This product is no longer available")) {
            isAvailable = false;
        }

        if (price !== null) {
            return { price, isAvailable };
        }

        return null;
    } catch (error) {
        console.error("AliExpress specific parse error:", error);
        return null; // Return null on error so fallback can try
    }
}
