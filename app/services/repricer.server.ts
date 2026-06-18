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
        console.error("Target margin too high (>=99%), aborting reprice to avoid infinite price.");
        return null;
    }

    const rawTargetPrice = totalCost / (1 - marginDecimal);
    const targetPrice = Math.ceil(rawTargetPrice * 100) / 100;

    console.log(`[Repricer] Cost: ${newCost}, Ship: ${shippingCost}, Total: ${totalCost}`);
    console.log(`[Repricer] Target Margin: ${targetMarginPercent}%, New Price: ${targetPrice}`);

    // 2. Update Shopify
    const admin = await shopify.unauthenticated.admin(shop);

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

    const productRes: any = await admin.graphql(productQuery).then(res => res.json());
    const variantId = productRes.data?.product?.variants?.edges[0]?.node?.id;

    if (!variantId) {
        console.error("[Repricer] Could not find variant ID to update.");
        return null;
    }

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

    const updateRes: any = await admin.graphql(updateMutation, {
        variables: {
            input: {
                id: variantId,
                price: targetPrice.toFixed(2)
            }
        }
    }).then(res => res.json());

    if (updateRes.data?.productVariantUpdate?.userErrors?.length > 0) {
        console.error("[Repricer] Update failed:", updateRes.data.productVariantUpdate.userErrors);
        return null;
    }

    console.log(`[Repricer] Success! Updated ${variantId} to $${targetPrice}`);
    return targetPrice;
}
