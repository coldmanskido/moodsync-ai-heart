import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import {
    Page,
    Layout,
    Card,
    BlockStack,
    Text,
    Button,
    InlineStack,
    Icon,
    Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { CheckCircleIcon, ProductIcon, LinkIcon, AlertCircleIcon } from "@shopify/polaris-icons";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    await authenticate.admin(request);
    return json({});
};

export default function Onboarding() {
    return (
        <Page>
            <Layout>
                <Layout.Section>
                    <Card>
                        <BlockStack gap="500">
                            <BlockStack gap="200" align="center">
                                <Text as="h1" variant="headingLg">Welcome to The 1% Supplier</Text>
                                <Text as="p" variant="bodyMd" tone="subdued">
                                    Your automated guardian for profit margins. Set it up once, and never lose money to a supplier price hike again.
                                </Text>
                            </BlockStack>

                            <Banner tone="info">
                                <p><strong>New here?</strong> Test our scraper first to see it in action → <a href="/app/test-scraper" style={{ textDecoration: 'underline' }}>Scraper Diagnostic</a></p>
                            </Banner>

                            <Divider />

                            <BlockStack gap="400">
                                <InlineStack gap="400" wrap={false} align="start">
                                    <div style={{ padding: '12px', background: '#fff', borderRadius: '50%', border: '2px solid #008060' }}>
                                        <Icon source={LinkIcon} tone="success" />
                                    </div>
                                    <BlockStack gap="100">
                                        <Text as="h3" variant="headingMd">1. Link Your Suppliers</Text>
                                        <Text as="p" variant="bodyMd">
                                            Go to <strong>Product Tracking</strong>. Paste AliExpress, DHgate, or Alibaba URLs next to your products.
                                            We support <strong>any supplier site</strong> - even generic ones!
                                        </Text>
                                    </BlockStack>
                                </InlineStack>

                                <InlineStack gap="400" wrap={false} align="start">
                                    <div style={{ padding: '12px', background: '#fff', borderRadius: '50%', border: '2px solid #008060' }}>
                                        <Icon source={AlertCircleIcon} tone="success" />
                                    </div>
                                    <BlockStack gap="100">
                                        <Text as="h3" variant="headingMd">2. Activate Automation</Text>
                                        <Text as="p" variant="bodyMd">
                                            Enable <strong>Auto</strong> to automatically update prices when supplier costs rise.
                                            Enable <strong>OOS</strong> to sync stock when suppliers go out-of-stock.
                                        </Text>
                                    </BlockStack>
                                </InlineStack>

                                <InlineStack gap="400" wrap={false} align="start">
                                    <div style={{ padding: '12px', background: '#fff', borderRadius: '50%', border: '2px solid #008060' }}>
                                        <Icon source={ProductIcon} tone="success" />
                                    </div>
                                    <BlockStack gap="100">
                                        <Text as="h3" variant="headingMd">3. Monitor & Relax</Text>
                                        <Text as="p" variant="bodyMd">
                                            Check the <strong>Dashboard</strong> for price trends and margin health.
                                            We monitor 24/7 so you don't have to.
                                        </Text>
                                    </BlockStack>
                                </InlineStack>
                            </BlockStack>

                            <Divider />

                            <InlineStack gap="300" align="center">
                                <Button variant="primary" size="large" url="/app/bulk">Start Tracking Products</Button>
                                <Button url="/app/test-scraper">Test Live Scraper</Button>
                            </InlineStack>
                        </BlockStack>
                    </Card>
                </Layout.Section>
            </Layout>
        </Page>
    );
}

function Divider() {
    return <div style={{ height: '1px', background: '#e1e1e1', margin: '20px 0' }} />;
}
