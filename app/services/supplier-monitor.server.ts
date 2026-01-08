import { parseAliExpress } from "./scrapers/aliexpress.server";
import { parseDHgate } from "./scrapers/dhgate.server";
import { parseAlibaba } from "./scrapers/alibaba.server";

export async function fetchSupplierPrice(url: string): Promise<{ price: number, isAvailable: boolean } | null> {
    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
        });

        if (!response.ok) {
            console.error(`Failed to fetch supplier page: ${response.statusText}`);
            return null;
        }

        const html = await response.text();

        // 1. STRATEGY: SPECIALIST SCRAPERS
        // Route to appropriate scraper based on URL
        if (url.includes("aliexpress")) {
            const aliResult = await parseAliExpress(html);
            if (aliResult) return aliResult;
            console.warn("AliExpress parser failed, falling back to generic.");
        } else if (url.includes("dhgate")) {
            const dhResult = await parseDHgate(html);
            if (dhResult) return dhResult;
            console.warn("DHgate parser failed, falling back to generic.");
        } else if (url.includes("alibaba")) {
            const alibabaResult = await parseAlibaba(html);
            if (alibabaResult) return alibabaResult;
            console.warn("Alibaba parser failed, falling back to generic.");
        }

        // 2. STRATEGY: GENERIC FALLBACK (The "Catch-All")
        // Works for CJ, Spocket, Random Sites
        let price: number | null = null;
        let isAvailable = true; // Assume available for generic sites unless we find OOS text

        // A. Look for OpenGraph Price
        const ogPrice = html.match(/<meta property="product:price:amount" content="([\d]+)"/i);
        if (ogPrice && ogPrice[1]) price = parseFloat(ogPrice[1]);

        // B. Look for JSON "price" keys
        if (!price) {
            const priceRegex = /["']price["']\s*:\s*["']?([\d.,]+)["']?/i;
            const match = html.match(priceRegex);
            if (match && match[1]) {
                const priceStr = match[1].replace(/,/g, "");
                price = parseFloat(priceStr);
            }
        }

        // C. Visual Fallback ($XX.XX)
        if (!price) {
            const genericPriceRegex = /(\$\d+(\d{2})?)/;
            const genericMatch = html.match(genericPriceRegex);
            if (genericMatch && genericMatch[1]) {
                price = parseFloat(genericMatch[1].replace("$", ""));
            }
        }

        // D. Generic Availability Check
        if (html.toLowerCase().includes("out of stock") || html.toLowerCase().includes("currently unavailable")) {
            isAvailable = false;
        }

        if (price) {
            return { price, isAvailable };
        }

        console.warn(`Could not detect price for URL: ${url}`);
        return null;
    } catch (error) {
        console.error(`Error monitoring supplier price: ${error}`);
        return null;
    }
}
