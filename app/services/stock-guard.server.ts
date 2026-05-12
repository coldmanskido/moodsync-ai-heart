import shopify from "../shopify.server";

interface StockSyncOptions {
    shop: string;
    shopifyProductId: string;
}

async function getStockResources(shop: string, shopifyProductId: string) {
    const sessionId = (shopify.sessionStorage as any).getOfflineId(shop);
    const session = await shopify.sessionStorage.loadSession(sessionId);

    if (!session) {
        throw new Error(`No offline session found for shop ${shop}`);
    }

    const client = new (shopify.clients as any).Graphql({ session });

    const resourceQuery = `query {
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
        locations(first: 1) {
            edges {
                node {
                    id
                }
            }
        }
    }`;

    const res: any = await client.request(resourceQuery);
    const inventoryItemId = res.data?.product?.variants?.edges[0]?.node?.inventoryItem?.id;
    const locationId = res.data?.locations?.edges[0]?.node?.id;

    if (!inventoryItemId || !locationId) {
        throw new Error("Could not find inventory item or location ID.");
    }

    return { client, inventoryItemId, locationId };
}

async function setStockLevel(shop: string, shopifyProductId: string, quantity: number) {
    const { client, inventoryItemId, locationId } = await getStockResources(shop, shopifyProductId);

    const mutation = `mutation inventorySetHandQuantities($input: InventorySetHandQuantitiesInput!) {
        inventorySetHandQuantities(input: $input) {
            userErrors {
                field
                message
            }
        }
    }`;

    const res: any = await client.request(mutation, {
        variables: {
            input: {
                reason: "correction",
                setQuantities: [{ inventoryItemId, locationId, quantity }]
            }
        }
    });

    if (res.data?.inventorySetHandQuantities?.userErrors?.length > 0) {
        console.error("[Stock Guard] Update failed:", res.data.inventorySetHandQuantities.userErrors);
    }
}

export async function syncOutOfStock(options: StockSyncOptions) {
    console.log(`[Stock Guard] Syncing OOS for ${options.shopifyProductId}...`);
    try {
        await setStockLevel(options.shop, options.shopifyProductId, 0);
        console.log(`[Stock Guard] Successfully set ${options.shopifyProductId} to Out of Stock.`);
    } catch (error: any) {
        console.error(`[Stock Guard] OOS Sync Failed: ${error.message}`);
    }
}

export async function syncInStock(options: StockSyncOptions) {
    console.log(`[Stock Guard] Syncing In Stock for ${options.shopifyProductId}...`);
    try {
        await setStockLevel(options.shop, options.shopifyProductId, 100);
        console.log(`[Stock Guard] Successfully set ${options.shopifyProductId} back In Stock.`);
    } catch (error: any) {
        console.error(`[Stock Guard] In Stock Sync Failed: ${error.message}`);
    }
}
