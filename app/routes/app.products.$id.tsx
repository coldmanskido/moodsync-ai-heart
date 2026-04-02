import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
    Page,
    Layout,
    Text,
    Card,
    BlockStack,
    TextField,
    InlineGrid,
    Box,
    Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { useState } from "react";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
    await authenticate.admin(request);

    // In a real app, fetch this from Shopify and your DB
    const product = {
        id: params.id,
        title: "Classic Snowboard",
        currentPrice: 120.00,
        tracking: {
            supplierUrl: "https://example.com/supplier-product",
            costPerUnit: 45.00,
            shippingCost: 5.00,
            marginThreshold: 20,
        }
    };

    return json({ product });
};

export default function ProductDetail() {
    const { product } = useLoaderData<typeof loader>();
    const [supplierUrl, setSupplierUrl] = useState(product.tracking.supplierUrl);
    const [cost, setCost] = useState(product.tracking.costPerUnit.toString());
    const [shipping, setShipping] = useState(product.tracking.shippingCost.toString());
    const [threshold, setThreshold] = useState(product.tracking.marginThreshold.toString());

    return (
        <Page
            title={product.title}
            backAction={{ content: "Dashboard", url: "/app" }}
            primaryAction={{ content: "Save tracking", onAction: () => console.log("Saving...") }}
        >
            <Layout>
                <Layout.Section>
                    <Card>
                        <BlockStack gap="500">
                            <Text as="h2" variant="headingMd">Supplier Tracking Setup</Text>
                            <TextField
                                label="Supplier Product URL"
                                value={supplierUrl}
                                onChange={setSupplierUrl}
                                autoComplete="off"
                                helpText="The URL of the product on the supplier's website (AliExpress, etc.)"
                            />
                            <InlineGrid columns={3} gap="400">
                                <TextField
                                    label="Cost per unit ($)"
                                    type="number"
                                    value={cost}
                                    onChange={setCost}
                                    autoComplete="off"
                                />
                                <TextField
                                    label="Shipping cost ($)"
                                    type="number"
                                    value={shipping}
                                    onChange={setShipping}
                                    autoComplete="off"
                                />
                                <TextField
                                    label="Margin alert threshold (%)"
                                    type="number"
                                    value={threshold}
                                    onChange={setThreshold}
                                    autoComplete="off"
                                    helpText="Alert me if margin drops below this"
                                />
                            </InlineGrid>
                        </BlockStack>
                    </Card>
                </Layout.Section>

                <Layout.Section variant="oneThird">
                    <Card>
                        <BlockStack gap="400">
                            <Text as="h2" variant="headingMd">Margin Preview</Text>
                            <Box>
                                <InlineGrid columns={2}>
                                    <Text as="p" variant="bodyMd">Selling Price</Text>
                                    <Text as="p" variant="bodyMd" fontWeight="bold" textAlign="end">${product.currentPrice.toFixed(2)}</Text>
                                </InlineGrid>
                            </Box>
                            <Box>
                                <InlineGrid columns={2}>
                                    <Text as="p" variant="bodyMd">Total Cost</Text>
                                    <Text as="p" variant="bodyMd" fontWeight="bold" textAlign="end">${(parseFloat(cost) + parseFloat(shipping)).toFixed(2)}</Text>
                                </InlineGrid>
                            </Box>
                            <Divider />
                            <Box>
                                <InlineGrid columns={2}>
                                    <Text as="p" variant="headingMd">Profit Margin</Text>
                                    <Text as="p" variant="headingMd" fontWeight="bold" textAlign="end" tone="success">
                                        {(((product.currentPrice - (parseFloat(cost) + parseFloat(shipping))) / product.currentPrice) * 100).toFixed(1)}%
                                    </Text>
                                </InlineGrid>
                            </Box>
                        </BlockStack>
                    </Card>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
