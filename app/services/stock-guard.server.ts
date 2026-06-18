import shopify from "../shopify.server";

interface StockSyncOptions {
    shop: string;
    shopifyProductId: string;
    cost?: number;
}

async function getInventoryContext(shop: string, shopifyProductId: string) {
    const admin = await shopify.unauthenticated.admin(shop);

    // 1. Get Inventory Item ID (via Variant)
    const productQuery = `query {
        product(id: "${shopifyProductId}") {
            variants(first: 1) {
                edges {
                    node {
                        id
                        inventoryItem {
                            id
                        }
                    }
                }
            }
        }
    }`;

    const productRes: any = await admin.graphql(productQuery).then(res => res.json());
    const inventoryItemId = productRes.data?.product?.variants?.edges[0]?.node?.inventoryItem?.id;

    if (!inventoryItemId) {
        console.error("[Stock Guard] Could not find inventory item ID.");
        return null;
    }

    // 2. Fetch locations first.
    const locationQuery = `query {
        locations(first: 1) {
            edges {
                node {
                    id
                }
            }
        }
    }`;
    const locationRes: any = await admin.graphql(locationQuery).then(res => res.json());
    const locationId = locationRes.data?.locations?.edges[0]?.node?.id;

    if (!locationId) {
        console.error("[Stock Guard] Could not find location ID.");
        return null;
    }

    return { admin, inventoryItemId, locationId };
}

export async function syncOutOfStock(options: StockSyncOptions) {
    const { shop, shopifyProductId } = options;
    console.log(`[Stock Guard] Syncing OOS for ${shopifyProductId}...`);

    const ctx = await getInventoryContext(shop, shopifyProductId);
    if (!ctx) return;

    const { admin, inventoryItemId, locationId } = ctx;

    const mutation = `mutation inventorySetHandQuantities($input: InventorySetHandQuantitiesInput!) {
        inventorySetHandQuantities(input: $input) {
            inventoryAdjustmentGroup {
                reason
                changes {
                    name
                    delta
                }
            }
            userErrors {
                field
                message
            }
        }
    }`;

    await admin.graphql(mutation, {
        variables: {
            input: {
                reason: "correction",
                setQuantities: [
                    {
                        inventoryItemId: inventoryItemId,
                        locationId: locationId,
                        quantity: 0
                    }
                ]
            }
        }
    });

    console.log(`[Stock Guard] Successfully set ${shopifyProductId} to Out of Stock.`);
}

export async function syncInStock(options: StockSyncOptions) {
    const { shop, shopifyProductId } = options;
    console.log(`[Stock Guard] Restoring stock for ${shopifyProductId}...`);

    const ctx = await getInventoryContext(shop, shopifyProductId);
    if (!ctx) return;

    const { admin, inventoryItemId, locationId } = ctx;

    const mutation = `mutation inventorySetHandQuantities($input: InventorySetHandQuantitiesInput!) {
        inventorySetHandQuantities(input: $input) {
            inventoryAdjustmentGroup {
                reason
                changes {
                    name
                    delta
                }
            }
            userErrors {
                field
                message
            }
        }
    }`;

    // Restore to a default level (e.g., 100) or we could fetch last level if we tracked it.
    await admin.graphql(mutation, {
        variables: {
            input: {
                reason: "correction",
                setQuantities: [
                    {
                        inventoryItemId: inventoryItemId,
                        locationId: locationId,
                        quantity: 100
                    }
                ]
            }
        }
    });

    console.log(`[Stock Guard] Successfully restored stock for ${shopifyProductId}.`);
}
