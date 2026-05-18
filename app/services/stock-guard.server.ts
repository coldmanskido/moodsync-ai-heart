import shopify from "../shopify.server";

interface StockSyncOptions {
    shop: string;
    shopifyProductId: string;
    cost?: number;
}

/**
 * Shared helper to get Shopify Session and GraphQL Client
 */
async function getStockResources(shop: string) {
    const sessionId = shopify.sessionStorage.getOfflineId(shop);
    const session = await shopify.sessionStorage.loadSession(sessionId);

    if (!session) {
        throw new Error(`No offline session found for shop ${shop}`);
    }

    const client = new shopify.clients.Graphql({ session });
    return { client };
}

/**
 * Sets Shopify inventory to 0 when supplier is out of stock.
 */
export async function syncOutOfStock(options: StockSyncOptions) {
    const { shop, shopifyProductId } = options;
    console.log(`[Stock Guard] Syncing OOS for ${shopifyProductId}...`);

    try {
        const { client } = await getStockResources(shop);

        // 1. Get Inventory Item ID and Location ID
        const dataQuery = `query {
            product(id: "${shopifyProductId}") {
                variants(first: 1) {
                    edges {
                        node {
                            inventoryItem {
                                id
                            }
                        }
                    }
                }
            }
            locations(first: 1) {
                edges {
                    node {
                        id
                    }
                }
            }
        }`;

        const res: any = await client.request(dataQuery);
        const inventoryItemId = res.data?.product?.variants?.edges[0]?.node?.inventoryItem?.id;
        const locationId = res.data?.locations?.edges[0]?.node?.id;

        if (!inventoryItemId || !locationId) {
            console.error("[Stock Guard] Could not find required IDs (Inventory or Location).");
            return;
        }

        // 2. Set Quantity to 0
        const mutation = `mutation inventorySetHandQuantities($input: InventorySetHandQuantitiesInput!) {
            inventorySetHandQuantities(input: $input) {
                userErrors { field message }
            }
        }`;

        await client.request(mutation, {
            variables: {
                input: {
                    reason: "correction",
                    setQuantities: [{ inventoryItemId, locationId, quantity: 0 }]
                }
            }
        });

        console.log(`[Stock Guard] Successfully set ${shopifyProductId} to OOS.`);
    } catch (error) {
        console.error("[Stock Guard] OOS Sync Failed:", error);
    }
}

/**
 * Restores inventory when product is back in stock at supplier.
 * Sets to a default high number (e.g., 100) since we don't know supplier's exact count.
 */
export async function syncInStock(options: StockSyncOptions) {
    const { shop, shopifyProductId } = options;
    console.log(`[Stock Guard] Restoring Stock for ${shopifyProductId}...`);

    try {
        const { client } = await getStockResources(shop);

        // 1. Get IDs
        const dataQuery = `query {
            product(id: "${shopifyProductId}") {
                variants(first: 1) {
                    edges {
                        node {
                            inventoryItem {
                                id
                            }
                        }
                    }
                }
            }
            locations(first: 1) {
                edges {
                    node {
                        id
                    }
                }
            }
        }`;

        const res: any = await client.request(dataQuery);
        const inventoryItemId = res.data?.product?.variants?.edges[0]?.node?.inventoryItem?.id;
        const locationId = res.data?.locations?.edges[0]?.node?.id;

        if (!inventoryItemId || !locationId) return;

        // 2. Set Quantity to 100
        const mutation = `mutation inventorySetHandQuantities($input: InventorySetHandQuantitiesInput!) {
            inventorySetHandQuantities(input: $input) {
                userErrors { field message }
            }
        }`;

        await client.request(mutation, {
            variables: {
                input: {
                    reason: "correction",
                    setQuantities: [{ inventoryItemId, locationId, quantity: 100 }]
                }
            }
        });

        console.log(`[Stock Guard] Successfully restored ${shopifyProductId} to In Stock (100).`);
    } catch (error) {
        console.error("[Stock Guard] In-Stock Sync Failed:", error);
    }
}
