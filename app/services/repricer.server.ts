import shopify from "../shopify.server";

interface RepriceOptions {
    shop: string;
    shopifyProductId: string;
    newCost: number;
    shippingCost: number;
    targetMarginPercent: number;
}

export async function updateShopifyPrice(options: RepriceOptions) {
    const { shop, shopifyProductId, newCost, shippingCost, targetMarginPercent } = options;

    console.log(`[Repricer] Calculating new price for ${shopifyProductId}...`);

    // 1. Calculate Target Price
    // Formula: Price = TotalCost / (1 - Margin%)
    // TotalCost = Cost + Shipping
    const totalCost = newCost + shippingCost;
    const marginDecimal = targetMarginPercent / 100;

    // Safety: prevent divide by zero or negative margin absurdities
    if (marginDecimal >= 0.99) {
        console.error("Target margin too high (>=99%), aborting reprice to avoid infinite price.");
        return null;
    }

    // Round to 2 decimals
    const rawTargetPrice = totalCost / (1 - marginDecimal);
    const targetPrice = Math.ceil(rawTargetPrice * 100) / 100; // Ceiling to penny for safety

    console.log(`[Repricer] Cost: ${newCost}, Ship: ${shippingCost}, Total: ${totalCost}`);
    console.log(`[Repricer] Target Margin: ${targetMarginPercent}%, New Price: ${targetPrice}`);

    // 2. Update Shopify
    // We need an offline session to interact with Admin API in background
    const sessionId = (shopify.sessionStorage as any).getOfflineId(shop);
    const session = await shopify.sessionStorage.loadSession(sessionId);

    if (!session) {
        console.error(`[Repricer] No offline session found for shop ${shop}`);
        return null;
    }

    const client = new (shopify.clients as any).Graphql({ session });

    // Mutation to update first variant (Simplification for MVP)
    // In strict mode, we should map specific variants, but usually dropshipping is 1-1 or simple variants.
    // We'll fetch the product to get the first variant ID.

    // A. Get Variant ID
    const productQuery = `query {
        product(id: "${shopifyProductId}") {
            variants(first: 1) {
                edges {
                    node {
                        id
                        price
                    }
                }
            }
        }
    }`;

    const productRes: any = await client.request(productQuery);
    const variantId = productRes.data?.product?.variants?.edges[0]?.node?.id;

    if (!variantId) {
        console.error("[Repricer] Could not find variant ID to update.");
        return null;
    }

    // B. Update Price
    const updateMutation = `mutation productVariantUpdate($input: ProductVariantInput!) {
        productVariantUpdate(input: $input) {
            productVariant {
                id
                price
            }
            userErrors {
                field
                message
            }
        }
    }`;

    const updateRes: any = await client.request(updateMutation, {
        variables: {
            input: {
                id: variantId,
                price: targetPrice.toFixed(2)
            }
        }
    });

    if (updateRes.data?.productVariantUpdate?.userErrors?.length > 0) {
        console.error("[Repricer] Update failed:", updateRes.data.productVariantUpdate.userErrors);
        return null;
    }

    console.log(`[Repricer] Success! Updated ${variantId} to $${targetPrice}`);
    return targetPrice;
}
