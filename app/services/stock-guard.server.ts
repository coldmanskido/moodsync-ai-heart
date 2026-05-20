import shopify from "../shopify.server";

interface StockSyncOptions {
    shop: string;
    shopifyProductId: string;
}

export async function syncOutOfStock(options: StockSyncOptions) {
    const { shop, shopifyProductId } = options;
    console.log(`[Stock Guard] Syncing OOS for ${shopifyProductId}...`);

    try {
        const { admin } = await (shopify.unauthenticated as any).admin(shop);

        // 1. Get Inventory Item ID (via Variant)
        const productQuery = `#graphql
            query getInventoryItem($id: ID!) {
                product(id: $id) {
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
            }
        `;

        const productRes = await admin.graphql(productQuery, {
            variables: { id: shopifyProductId }
        });
        const productData = await productRes.json();
        const inventoryItemId = productData.data?.product?.variants?.edges[0]?.node?.inventoryItem?.id;

        if (!inventoryItemId) {
            console.error("[Stock Guard] Could not find inventory item ID.");
            return;
        }

        // 2. Fetch locations
        const locationQuery = `#graphql
            query getLocations {
                locations(first: 1) {
                    edges {
                        node {
                            id
                        }
                    }
                }
            }
        `;
        const locationRes = await admin.graphql(locationQuery);
        const locationData = await locationRes.json();
        const locationId = locationData.data?.locations?.edges[0]?.node?.id;

        if (!locationId) {
            console.error("[Stock Guard] Could not find location ID.");
            return;
        }

        // 3. Adjust Inventory to 0
        const mutation = `#graphql
            mutation inventorySetHandQuantities($input: InventorySetHandQuantitiesInput!) {
                inventorySetHandQuantities(input: $input) {
                    userErrors {
                        field
                        message
                    }
                }
            }
        `;

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
    } catch (error) {
        console.error(`[Stock Guard] Failed to sync OOS:`, error);
    }
}

export async function syncInStock(options: StockSyncOptions) {
    const { shop, shopifyProductId } = options;
    console.log(`[Stock Guard] Syncing Back in Stock for ${shopifyProductId}...`);

    try {
        const { admin } = await (shopify.unauthenticated as any).admin(shop);

        // 1. Get Inventory Item ID
        const productQuery = `#graphql
            query getInventoryItem($id: ID!) {
                product(id: $id) {
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
            }
        `;

        const productRes = await admin.graphql(productQuery, {
            variables: { id: shopifyProductId }
        });
        const productData = await productRes.json();
        const inventoryItemId = productData.data?.product?.variants?.edges[0]?.node?.inventoryItem?.id;

        if (!inventoryItemId) return;

        // 2. Fetch location
        const locationQuery = `#graphql
            query getLocations {
                locations(first: 1) {
                    edges {
                        node {
                            id
                        }
                    }
                }
            }
        `;
        const locationRes = await admin.graphql(locationQuery);
        const locationData = await locationRes.json();
        const locationId = locationData.data?.locations?.edges[0]?.node?.id;

        if (!locationId) return;

        // 3. Restore Inventory (Set to 100 as default stock level)
        const mutation = `#graphql
            mutation inventorySetHandQuantities($input: InventorySetHandQuantitiesInput!) {
                inventorySetHandQuantities(input: $input) {
                    userErrors {
                        field
                        message
                    }
                }
            }
        `;

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
    } catch (error) {
        console.error(`[Stock Guard] Failed to sync In Stock:`, error);
    }
}
