import { json, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import {
    Page,
    Layout,
    Card,
    BlockStack,
    TextField,
    Button,
    Text,
    Banner,
    Select,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import { fetchSupplierPrice } from "../services/supplier-monitor.server";
import * as emailService from "../services/email.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { session } = await authenticate.admin(request);
    const formData = await request.formData();
    const actionType = formData.get("actionType") || "scrape";

    if (actionType === "testEmail") {
        const testEmail = formData.get("email") as string || session.email || "test@example.com";
        const emailType = formData.get("emailType") as string;

        switch (emailType) {
            case "margin":
                await emailService.sendMarginAlertEmail(testEmail, {
                    productTitle: "Test High-Margin Product",
                    productImage: "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png",
                    currentMargin: 8.5,
                    threshold: 20,
                    currentCost: 45.00,
                    currentPrice: 52.00,
                    suggestedPrice: 65.00
                });
                break;
            case "priceDrop":
                await emailService.sendPriceDropEmail(testEmail, {
                    productTitle: "Profit Opportunity Item",
                    productImage: "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png",
                    oldCost: 120.00,
                    newCost: 95.00,
                    marginIncrease: 12.5
                });
                break;
            case "oos":
                await emailService.sendOOSAlertEmail(testEmail, {
                    productTitle: "Sold Out Bestseller",
                    productImage: "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                });
                break;
            case "backInStock":
                await emailService.sendBackInStockEmail(testEmail, {
                    productTitle: "Success Item Redux",
                    productImage: "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                });
                break;
            case "digest":
                await emailService.sendDailyDigestEmail(testEmail, {
                    profitProtected: 1245.50,
                    checksPerformed: 450,
                    priceAdjustments: 12,
                    criticalAlerts: 2
                });
                break;
            case "health":
                await emailService.sendScraperHealthEmail(testEmail, {
                    productTitle: "Broken Link Item",
                    url: "https://example.com/broken",
                    errorCode: "404_NOT_FOUND"
                });
                break;
            case "welcome":
                await emailService.sendWelcomeEmail(testEmail, 1);
                break;
        }

        return json({ success: true, message: `Test '${emailType}' email sent to ${testEmail}. Check server logs!` });
    }

    const url = formData.get("url") as string;
    if (!url) return json({ error: "URL is required" });

    try {
        const startTime = Date.now();
        const result = await fetchSupplierPrice(url);
        const duration = Date.now() - startTime;

        if (!result) throw new Error("Could not detect price");

        return json({
            success: true,
            price: result.price,
            isAvailable: result.isAvailable,
            url,
            duration: `${duration}ms`,
            parser: url.includes("aliexpress") ? "AliExpress Specialist" :
                url.includes("dhgate") ? "DHgate Specialist" :
                    url.includes("alibaba") ? "Alibaba Specialist" : "Generic Fallback"
        });
    } catch (error) {
        return json({ error: error.message || "Failed to fetch price" });
    }
};

export default function TestScraper() {
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const isLoading = navigation.state === "submitting" && navigation.formData?.get("actionType") !== "testEmail";
    const isSendingEmail = navigation.state === "submitting" && navigation.formData?.get("actionType") === "testEmail";

    const [url, setUrl] = useState("");
    const [email, setEmail] = useState("");
    const [emailType, setEmailType] = useState("margin");

    const emailOptions = [
        { label: 'Margin Risk Alert', value: 'margin' },
        { label: 'Price Drop Opportunity', value: 'priceDrop' },
        { label: 'Out of Stock Alert', value: 'oos' },
        { label: 'Back in Stock Victory', value: 'backInStock' },
        { label: 'Daily Defense Digest', value: 'digest' },
        { label: 'Scraper Health Alert', value: 'health' },
        { label: 'Welcome Guide (Step 1)', value: 'welcome' },
    ];

    return (
        <Page title="Diagnostic Tools" backAction={{ content: "Dashboard", url: "/app" }}>
            <Layout>
                <Layout.Section>
                    <BlockStack gap="500">
                        {/* 1. Scraper Test */}
                        <Card>
                            <BlockStack gap="400">
                                <Text as="h2" variant="headingMd">Hybrid Scraper Test</Text>
                                <Text as="p" variant="bodyMd">
                                    Test the detection logic against real supplier pages.
                                </Text>

                                <Form method="post">
                                    <input type="hidden" name="actionType" value="scrape" />
                                    <BlockStack gap="400">
                                        <TextField
                                            label="Supplier URL"
                                            name="url"
                                            value={url}
                                            onChange={setUrl}
                                            autoComplete="off"
                                            placeholder="https://www.aliexpress.com/item/..."
                                        />
                                        <Button submit loading={isLoading} variant="primary">
                                            Run Scrape Test
                                        </Button>
                                    </BlockStack>
                                </Form>

                                {actionData?.error && (
                                    <Banner tone="critical" title="Scrape Failed">
                                        <p>{actionData.error}</p>
                                    </Banner>
                                )}

                                {actionData?.success && actionData.price !== undefined && (
                                    <Banner tone="success" title="Scrape Results">
                                        <BlockStack gap="200">
                                            <Text as="h2" variant="headingLg" fontWeight="bold">
                                                ${actionData.price}
                                                <span style={{ fontSize: '14px', fontWeight: 'normal', marginLeft: '8px', color: actionData.isAvailable ? '#008060' : '#8e1f0b' }}>
                                                    ({actionData.isAvailable ? "In Stock" : "Out of Stock"})
                                                </span>
                                            </Text>
                                            <Text as="p" variant="bodySm" tone="subdued">
                                                By: <strong>{actionData.parser}</strong> in {actionData.duration}
                                            </Text>
                                        </BlockStack>
                                    </Banner>
                                )}
                            </BlockStack>
                        </Card>

                        {/* 2. Email Test */}
                        <Card>
                            <BlockStack gap="400">
                                <Text as="h2" variant="headingMd">Email Library Test</Text>
                                <Text as="p" variant="bodyMd">
                                    Send "fancy" mock alerts to verify all available modern templates.
                                </Text>

                                <Form method="post">
                                    <input type="hidden" name="actionType" value="testEmail" />
                                    <BlockStack gap="400">
                                        <Select
                                            label="Alert Type"
                                            name="emailType"
                                            options={emailOptions}
                                            value={emailType}
                                            onChange={setEmailType}
                                        />
                                        <TextField
                                            label="Destination Email"
                                            name="email"
                                            value={email}
                                            onChange={setEmail}
                                            placeholder="your-email@example.com"
                                            autoComplete="email"
                                        />
                                        <Button submit loading={isSendingEmail}>
                                            Send Test Alert
                                        </Button>
                                    </BlockStack>
                                </Form>

                                {actionData?.success && actionData.message && (
                                    <Banner tone="info" title="Test Complete">
                                        <p>{actionData.message}</p>
                                    </Banner>
                                )}
                            </BlockStack>
                        </Card>
                    </BlockStack>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
