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
    const totalCost = newCost + shippingCost;
    const marginDecimal = targetMarginPercent / 100;

    if (marginDecimal >= 0.99) {
        console.error("Target margin too high (>=99%), aborting reprice.");
        return null;
    }

    const rawTargetPrice = totalCost / (1 - marginDecimal);
    const targetPrice = Math.ceil(rawTargetPrice * 100) / 100;

    // 2. Update Shopify
    try {
        const { admin } = await (shopify.unauthenticated as any).admin(shop);

        // A. Get Variant ID
        const productQuery = `#graphql
            query getVariant($id: ID!) {
                product(id: $id) {
                    variants(first: 1) {
                        edges {
                            node {
                                id
                            }
                        }
                    }
                }
            }
        `;

        const productRes = await admin.graphql(productQuery, {
            variables: { id: shopifyProductId }
        });
        const productData = await productRes.json();
        const variantId = productData.data?.product?.variants?.edges[0]?.node?.id;

        if (!variantId) {
            console.error("[Repricer] Could not find variant ID.");
            return null;
        }

        // B. Update Price
        const updateMutation = `#graphql
            mutation productVariantUpdate($input: ProductVariantInput!) {
                productVariantUpdate(input: $input) {
                    userErrors {
                        field
                        message
                    }
                }
            }
        `;

        const updateRes = await admin.graphql(updateMutation, {
            variables: {
                input: {
                    id: variantId,
                    price: targetPrice.toFixed(2)
                }
            }
        });
        const updateData = await updateRes.json();

        if (updateData.data?.productVariantUpdate?.userErrors?.length > 0) {
            console.error("[Repricer] Update failed:", updateData.data.productVariantUpdate.userErrors);
            return null;
        }

        console.log(`[Repricer] Success! Updated ${variantId} to $${targetPrice}`);
        return targetPrice;
    } catch (error) {
        console.error(`[Repricer] Failed to reprice:`, error);
        return null;
    }
}
