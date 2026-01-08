// Product Tracking Page with Pagination
import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher, useSearchParams } from "@remix-run/react";
import {
    Page,
    Card,
    Thumbnail,
    TextField,
    Button,
    Text,
    Badge,
    Banner,
    EmptyState,
    InlineStack,
    BlockStack,
    Pagination,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// 1. LOADER: Fetch Shopify Products + Our DB Tracking Data
export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { admin } = await authenticate.admin(request);

    const url = new URL(request.url);
    const after = url.searchParams.get("after") || null;
    const before = url.searchParams.get("before") || null;

    const queryArgs = after
        ? `first: 20, after: "${after}"`
        : before
            ? `last: 20, before: "${before}"`
            : `first: 20`;

    // Fetch products with pagination
    const response = await admin.graphql(
        `#graphql
      query getProducts {
        products(${queryArgs}) {
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
          edges {
            node {
              id
              title
              featuredImage {
                url
              }
              variants(first: 1) {
                  edges {
                      node {
                          price
                      }
                  }
              }
            }
          }
        }
      }`
    );

    const responseJson = await response.json();
    const shopifyProducts = responseJson.data.products.edges.map((edge: any) => edge.node);
    const pageInfo = responseJson.data.products.pageInfo;

    // Fetch existing tracking data
    const trackingEntries = await prisma.trackingEntry.findMany({
        where: {
            shopifyProductId: {
                in: shopifyProducts.map((p: any) => p.id),
            },
        },
        include: {
            supplierProduct: true,
        },
    });

    // Merge logic
    const products = shopifyProducts.map((p: any) => {
        const tracking = trackingEntries.find((t) => t.shopifyProductId === p.id);
        return {
            id: p.id,
            title: p.title,
            image: p.featuredImage?.url || "",
            price: p.variants.edges[0]?.node.price || "0.00",
            // If tracked, use DB values. If not, defaults.
            supplierUrl: tracking?.supplierProduct.url || "",
            cost: tracking?.costPerUnit || "",
            shipping: tracking?.shippingCost || "0",
            autoUpdate: tracking?.autoUpdatePrice || false,
            autoStock: tracking?.autoStockSync || false,
            isTracked: !!tracking,
        };
    });

    return json({ products, pageInfo });
};

// 2. ACTION: Save Tracking Data (Row by Row)
export const action = async ({ request }: ActionFunctionArgs) => {
    const { session } = await authenticate.admin(request);
    const { shop } = session;
    const formData = await request.formData();

    const shopifyProductId = formData.get("shopifyProductId") as string;
    const shopifyTitle = formData.get("shopifyTitle") as string;
    const supplierUrl = formData.get("supplierUrl") as string;
    const cost = parseFloat((formData.get("cost") as string) || "0");
    const shipping = parseFloat((formData.get("shipping") as string) || "0");
    const autoUpdate = formData.get("autoUpdate") === "on";
    const autoStock = formData.get("autoStock") === "on";

    if (!supplierUrl) {
        // If URL empty, maybe delete tracking? For now, just ignore/error
        return json({ status: "error", message: "Supplier URL required" });
    }

    // A. Upsert SupplierProduct
    // We try to find if this URL already exists to reuse ID, or create new
    let supplierProduct = await prisma.supplierProduct.findUnique({
        where: { url: supplierUrl },
    });

    if (!supplierProduct) {
        supplierProduct = await prisma.supplierProduct.create({
            data: {
                url: supplierUrl,
                currentPrice: 0,
            },
        });
    }

    // B. Upsert TrackingEntry
    await prisma.trackingEntry.upsert({
        where: { shopifyProductId },
        update: {
            supplierProductId: supplierProduct.id,
            costPerUnit: cost,
            shippingCost: shipping,
            autoUpdatePrice: autoUpdate,
            autoStockSync: autoStock,
            shopifyTitle, // Update title in case it changed
        },
        create: {
            shop,
            shopifyProductId,
            shopifyTitle,
            supplierProductId: supplierProduct.id,
            costPerUnit: cost,
            shippingCost: shipping,
            marginThreshold: 20, // Default 20%
            autoUpdatePrice: autoUpdate,
            autoStockSync: autoStock,
        },
    });

    return json({ status: "success" });
};

// 3. UI: Product Card (Premium Design)
function ProductRow({ product }: { product: any }) {
    const fetcher = useFetcher();
    const isSaving = fetcher.state === "submitting";
    const isTracked = product.isTracked || fetcher.data?.status === "success";

    return (
        <div style={{ transition: 'all 0.2s ease' }}>
            <Card padding="400">
                <fetcher.Form method="post">
                    <input type="hidden" name="shopifyProductId" value={product.id} />
                    <input type="hidden" name="shopifyTitle" value={product.title} />

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) 1.5fr 1fr 1fr', gap: '20px', alignItems: 'center' }}>
                        {/* 1. Product Context */}
                        <InlineStack gap="300" blockAlign="center" wrap={false}>
                            <Thumbnail
                                source={product.image || ""}
                                alt={product.title}
                                size="medium"
                            />
                            <div style={{ overflow: 'hidden' }}>
                                <Text variant="bodyMd" fontWeight="bold" as="p" truncate>{product.title}</Text>
                                <InlineStack gap="200" blockAlign="center">
                                    <Text variant="bodySm" tone="subdued" as="p">Retail: ${product.price}</Text>
                                    {isTracked && <Badge tone="success">Tracked</Badge>}
                                </InlineStack>
                            </div>
                        </InlineStack>

                        {/* 2. Supplier Link */}
                        <TextField
                            label="Supplier URL"
                            name="supplierUrl"
                            value={product.supplierUrl}
                            placeholder="link"
                            disabled={isSaving}
                            autoComplete="off"
                            labelHidden
                        />

                        {/* 3. Costs & Toggles Combined for alignment */}
                        <InlineStack gap="200" blockAlign="center" wrap={false}>
                            <div style={{ width: "65px" }}>
                                <TextField
                                    label="Cost"
                                    name="cost"
                                    type="number"
                                    value={product.cost}
                                    placeholder="Cost"
                                    prefix="$"
                                    disabled={isSaving}
                                    autoComplete="off"
                                    labelHidden
                                />
                            </div>
                            <div style={{ width: "65px" }}>
                                <TextField
                                    label="Ship"
                                    name="shipping"
                                    type="number"
                                    value={product.shipping}
                                    placeholder="Ship"
                                    prefix="$"
                                    disabled={isSaving}
                                    autoComplete="off"
                                    labelHidden
                                />
                            </div>
                            <BlockStack gap="100">
                                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                                    <input type="checkbox" name="autoUpdate" defaultChecked={product.autoUpdate} disabled={isSaving} style={{ width: "14px", height: "14px", accentColor: "#008060" }} />
                                    <Text as="span" variant="bodyXs">Auto</Text>
                                </label>
                                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                                    <input type="checkbox" name="autoStock" defaultChecked={product.autoStock} disabled={isSaving} style={{ width: "14px", height: "14px", accentColor: "#008060" }} />
                                    <Text as="span" variant="bodyXs">Sync</Text>
                                </label>
                            </BlockStack>
                        </InlineStack>

                        {/* 4. Action */}
                        <div style={{ textAlign: 'right' }}>
                            <Button
                                submit
                                variant={isTracked ? "secondary" : "primary"}
                                loading={isSaving}
                                tone={isTracked ? "success" : undefined}
                                fullWidth
                            >
                                {isTracked ? "Update" : "Link Item"}
                            </Button>
                        </div>
                    </div>
                </fetcher.Form>
            </Card>
        </div>
    );
}

export default function BulkEditor() {
    const { products, pageInfo } = useLoaderData<typeof loader>();
    const [, setSearchParams] = useSearchParams();
    const trackedCount = products.filter((p: any) => p.isTracked).length;

    return (
        <Page title="Product Tracking" fullWidth>
            <BlockStack gap="400">
                {/* Info Banner */}
                <Banner
                    title="Defense Protocols Active"
                    tone="info"
                    onDismiss={() => { }}
                >
                    <BlockStack gap="200">
                        <p><strong>Auto Price:</strong> Automatically update your Shopify price when supplier costs rise to maintain margins.</p>
                        <p><strong>OOS Sync:</strong> Set inventory to 0 when supplier goes out of stock.</p>
                        <p style={{ marginTop: '4px', fontSize: '0.9rem', color: '#6d7175' }}>
                            <strong>Supported Platforms:</strong> AliExpress, CJ Dropshipping, DHgate, Alibaba, and generic supplier sites.
                        </p>
                    </BlockStack>
                </Banner>

                {/* Stats Bar */}
                {products.length > 0 && (
                    <Card padding="400">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                            <div style={{ textAlign: 'center', padding: '12px', background: '#f6f6f7', borderRadius: '8px' }}>
                                <Text as="h3" variant="bodySm" tone="subdued" fontWeight="bold">Total Products</Text>
                                <Text as="p" variant="headingLg">{products.length}</Text>
                            </div>
                            <div style={{ textAlign: 'center', padding: '12px', background: '#f0fcf5', borderRadius: '8px' }}>
                                <Text as="h3" variant="bodySm" tone="success" fontWeight="bold">Tracked Units</Text>
                                <Text as="p" variant="headingLg" tone="success">{trackedCount}</Text>
                            </div>
                            <div style={{ textAlign: 'center', padding: '12px', background: '#fff4f4', borderRadius: '8px' }}>
                                <Text as="h3" variant="bodySm" tone="critical" fontWeight="bold">Action Required</Text>
                                <Text as="p" variant="headingLg" tone="critical">{products.length - trackedCount}</Text>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Products List */}
                {products.length === 0 ? (
                    <Card>
                        <EmptyState
                            heading="No products in your store yet"
                            action={{
                                content: 'Add Products in Shopify',
                                url: 'https://admin.shopify.com/store/products',
                                external: true
                            }}
                            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                        >
                            <p>Create products in your Shopify store first, then return here to link them to supplier URLs for automatic price monitoring.</p>
                        </EmptyState>
                    </Card>
                ) : (
                    <>
                        <BlockStack gap="300">
                            {products.map((product: any) => (
                                <ProductRow key={product.id} product={product} />
                            ))}
                        </BlockStack>

                        {/* Pagination Controls */}
                        <div style={{ padding: '20px 0', borderTop: '1px solid #e1e3e5', marginTop: '10px' }}>
                            <InlineStack align="center">
                                <Pagination
                                    hasPrevious={pageInfo.hasPreviousPage}
                                    hasNext={pageInfo.hasNextPage}
                                    onPrevious={() => {
                                        setSearchParams({ before: pageInfo.startCursor });
                                    }}
                                    onNext={() => {
                                        setSearchParams({ after: pageInfo.endCursor });
                                    }}
                                />
                            </InlineStack>
                        </div>
                    </>
                )}
            </BlockStack>
        </Page>
    );
}
