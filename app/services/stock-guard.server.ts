import shopify from "../shopify.server";

interface StockSyncOptions {
    shop: string;
    shopifyProductId: string;
    cost?: number;
}

export async function syncOutOfStock(options: StockSyncOptions) {
    const { shop, shopifyProductId } = options;
    console.log(`[Stock Guard] Syncing OOS for ${shopifyProductId}...`);

    const { admin } = await (shopify as any).unauthenticated.admin(shop);

    // 1. Get Inventory Item ID (via Variant)
    // We assume 1 variant for MVP simplified approach
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

    const productRes = await admin.graphql(productQuery);
    const productResJson: any = await productRes.json();
    const inventoryItemId = productResJson.data?.product?.variants?.edges[0]?.node?.inventoryItem?.id;

    if (!inventoryItemId) {
        console.error("[Stock Guard] Could not find inventory item ID.");
        return;
    }

    // 2. Set Inventory to 0 (or some approach to mark OOS)
    // We need to know the Location ID to set inventory.
    // Fetch locations first.
    const locationQuery = `query {
        locations(first: 1) {
            edges {
                node {
                    id
                }
            }
        }
    }`;
    const locationRes = await admin.graphql(locationQuery);
    const locationResJson: any = await locationRes.json();
    const locationId = locationResJson.data?.locations?.edges[0]?.node?.id;

    if (!locationId) {
        console.error("[Stock Guard] Could not find location ID.");
        return;
    }

    // 3. Adjust Inventory to 0
    // inventorySetHandQuantities is the mutation.
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

    const { admin } = await (shopify as any).unauthenticated.admin(shop);

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

    const productRes = await admin.graphql(productQuery);
    const productResJson: any = await productRes.json();
    const inventoryItemId = productResJson.data?.product?.variants?.edges[0]?.node?.inventoryItem?.id;

    if (!inventoryItemId) {
        console.error("[Stock Guard] Could not find inventory item ID.");
        return;
    }

    // 2. Fetch locations
    const locationQuery = `query {
        locations(first: 1) {
            edges {
                node {
                    id
                }
            }
        }
    }`;
    const locationRes = await admin.graphql(locationQuery);
    const locationResJson: any = await locationRes.json();
    const locationId = locationResJson.data?.locations?.edges[0]?.node?.id;

    if (!locationId) {
        console.error("[Stock Guard] Could not find location ID.");
        return;
    }

    // 3. Set Inventory to a default "Back in Stock" value (e.g., 100)
    const mutation = `mutation inventorySetHandQuantities($input: InventorySetHandQuantitiesInput!) {
        inventorySetHandQuantities(input: $input) {
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
                        quantity: 100
                    }
                ]
            }
        }
    });

    console.log(`[Stock Guard] Successfully restored ${shopifyProductId} to In Stock.`);
}
