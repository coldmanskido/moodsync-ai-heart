import shopify from "../shopify.server";

export async function syncOutOfStock({ shop, shopifyProductId, cost }: { shop: string, shopifyProductId: string, cost?: number }) {
    console.log(`[Stock Guard] Syncing OOS for ${shopifyProductId}...`);

    const sessionId = shopify.sessionStorage.getOfflineId(shop);
    const session = await shopify.sessionStorage.loadSession(sessionId);

    if (!session) {
        console.error(`[Stock Guard] No offline session found for shop ${shop}`);
        return;
    }

    const client = new shopify.clients.Graphql({ session });

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

    const productRes = await client.request(productQuery);
    const inventoryItemId = productRes.data?.product?.variants?.edges[0]?.node?.inventoryItem?.id;

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
    const locationRes = await client.request(locationQuery);
    const locationId = locationRes.data?.locations?.edges[0]?.node?.id;

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

    await client.request(mutation, {
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

export async function syncInStock({ shop, shopifyProductId, cost }: { shop: string, shopifyProductId: string, cost?: number }) {
    console.log(`[Stock Guard] Syncing In Stock for ${shopifyProductId}...`);

    const sessionId = shopify.sessionStorage.getOfflineId(shop);
    const session = await shopify.sessionStorage.loadSession(sessionId);

    if (!session) {
        console.error(`[Stock Guard] No offline session found for shop ${shop}`);
        return;
    }

    const client = new shopify.clients.Graphql({ session });

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

    const productRes = await client.request(productQuery);
    const inventoryItemId = productRes.data?.product?.variants?.edges[0]?.node?.inventoryItem?.id;

    if (!inventoryItemId) {
        console.error("[Stock Guard] Could not find inventory item ID.");
        return;
    }

    // 2. Get Location ID
    const locationQuery = `query {
        locations(first: 1) {
            edges {
                node {
                    id
                }
            }
        }
    }`;
    const locationRes = await client.request(locationQuery);
    const locationId = locationRes.data?.locations?.edges[0]?.node?.id;

    if (!locationId) {
        console.error("[Stock Guard] Could not find location ID.");
        return;
    }

    // 3. Set Inventory to 100
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

    await client.request(mutation, {
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

    console.log(`[Stock Guard] Successfully set ${shopifyProductId} to In Stock (100).`);
}
