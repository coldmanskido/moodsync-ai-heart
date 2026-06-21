import shopify from "../shopify.server";

interface StockSyncOptions {
    shop: string;
    shopifyProductId: string;
    cost?: number;
}

export async function syncOutOfStock(options: StockSyncOptions) {
    const { shop, shopifyProductId } = options;
    console.log(`[Stock Guard] Syncing OOS for ${shopifyProductId}...`);

    try {
        const { admin } = await shopify.unauthenticated.admin(shop);

        // 1. Get Inventory Item ID (via Variant)
        const productRes = await admin.graphql(`#graphql
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
            }`,
            { variables: { id: shopifyProductId } }
        );

        const productData: any = await productRes.json();
        const inventoryItemId = productData.data?.product?.variants?.edges[0]?.node?.inventoryItem?.id;

        if (!inventoryItemId) {
            console.error("[Stock Guard] Could not find inventory item ID.");
            return;
        }

        // 2. Get Location ID
        const locationRes = await admin.graphql(`#graphql
            query getLocations {
                locations(first: 1) {
                    edges {
                        node {
                            id
                        }
                    }
                }
            }`
        );
        const locationData: any = await locationRes.json();
        const locationId = locationData.data?.locations?.edges[0]?.node?.id;

        if (!locationId) {
            console.error("[Stock Guard] Could not find location ID.");
            return;
        }

        // 3. Adjust Inventory to 0
        const mutationRes = await admin.graphql(`#graphql
            mutation inventorySetHandQuantities($input: InventorySetHandQuantitiesInput!) {
                inventorySetHandQuantities(input: $input) {
                    userErrors {
                        field
                        message
                    }
                }
            }`,
            {
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
            }
        );

        const mutationData: any = await mutationRes.json();
        if (mutationData.errors || mutationData.data?.inventorySetHandQuantities?.userErrors?.length > 0) {
            console.error("[Stock Guard] Failed to update inventory:", mutationData.errors || mutationData.data.inventorySetHandQuantities.userErrors);
            return;
        }

        console.log(`[Stock Guard] Successfully set ${shopifyProductId} to Out of Stock.`);
    } catch (error) {
        console.error(`[Stock Guard] Error in syncOutOfStock: ${error}`);
    }
}

export async function syncInStock(options: StockSyncOptions) {
    const { shop, shopifyProductId } = options;
    console.log(`[Stock Guard] Syncing In-Stock for ${shopifyProductId}...`);

    try {
        const { admin } = await shopify.unauthenticated.admin(shop);

        // 1. Get Inventory Item ID
        const productRes = await admin.graphql(`#graphql
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
            }`,
            { variables: { id: shopifyProductId } }
        );

        const productData: any = await productRes.json();
        const inventoryItemId = productData.data?.product?.variants?.edges[0]?.node?.inventoryItem?.id;

        if (!inventoryItemId) return;

        // 2. Get Location ID
        const locationRes = await admin.graphql(`#graphql
            query getLocations {
                locations(first: 1) {
                    edges {
                        node {
                            id
                        }
                    }
                }
            }`
        );
        const locationData: any = await locationRes.json();
        const locationId = locationData.data?.locations?.edges[0]?.node?.id;

        if (!locationId) return;

        // 3. Restore Inventory (Set to 100 as default)
        await admin.graphql(`#graphql
            mutation inventorySetHandQuantities($input: InventorySetHandQuantitiesInput!) {
                inventorySetHandQuantities(input: $input) {
                    userErrors {
                        field
                        message
                    }
                }
            }`,
            {
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
            }
        );

        console.log(`[Stock Guard] Successfully restored ${shopifyProductId} to In Stock.`);
    } catch (error) {
        console.error(`[Stock Guard] Error in syncInStock: ${error}`);
    }
}
