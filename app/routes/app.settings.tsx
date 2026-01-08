import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
    Page,
    Layout,
    Card,
    BlockStack,
    TextField,
    Select,
    Button,
    InlineStack,
    Text,
    Divider,
    Checkbox,
    Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { useState } from "react";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { session } = await authenticate.admin(request);
    const { shop } = session;

    let settings = await prisma.storeSettings.findUnique({
        where: { shop }
    });

    if (!settings) {
        settings = await prisma.storeSettings.create({
            data: {
                shop,
                alertEmail: session.email || ""
            }
        });
    }

    return json({ settings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const { session } = await authenticate.admin(request);
    const { shop } = session;
    const formData = await request.formData();

    const checkFrequency = parseInt(formData.get("checkFrequency") as string);
    const marginThreshold = parseFloat(formData.get("marginThreshold") as string);
    const paymentProcessorFee = parseFloat(formData.get("paymentProcessorFee") as string);
    const emailAlerts = formData.get("emailAlerts") === "true";
    const alertEmail = formData.get("alertEmail") as string;

    // New Global Switches
    const globalAutoReprice = formData.get("globalAutoReprice") === "true";
    const globalAutoOos = formData.get("globalAutoOos") === "true";
    const dailyDigestEnabled = formData.get("dailyDigestEnabled") === "true";
    const priceDropAlerts = formData.get("priceDropAlerts") === "true";

    await prisma.storeSettings.upsert({
        where: { shop },
        update: {
            checkFrequency,
            marginThreshold,
            paymentProcessorFee,
            emailAlerts,
            alertEmail,
            globalAutoReprice,
            globalAutoOos,
            dailyDigestEnabled,
            priceDropAlerts
        },
        create: {
            shop,
            checkFrequency,
            marginThreshold,
            paymentProcessorFee,
            emailAlerts,
            alertEmail,
            globalAutoReprice,
            globalAutoOos,
            dailyDigestEnabled,
            priceDropAlerts
        }
    });

    return json({ status: "success" });
};

export default function Settings() {
    const { settings } = useLoaderData<typeof loader>();
    const fetcher = useFetcher<any>();

    const [frequency, setFrequency] = useState(settings.checkFrequency.toString());
    const [threshold, setThreshold] = useState(settings.marginThreshold.toString());
    const [fee, setFee] = useState(settings.paymentProcessorFee.toString());
    const [emailEnabled, setEmailEnabled] = useState(settings.emailAlerts);
    const [alertEmail, setAlertEmail] = useState(settings.alertEmail || "");

    // New States
    const [autoReprice, setAutoReprice] = useState(settings.globalAutoReprice);
    const [autoOos, setAutoOos] = useState(settings.globalAutoOos);
    const [digestEnabled, setDigestEnabled] = useState(settings.dailyDigestEnabled);
    const [priceDropEnabled, setPriceDropEnabled] = useState(settings.priceDropAlerts);

    const isSaving = fetcher.state === "submitting";
    const showSuccess = fetcher.data?.status === "success";

    const frequencyOptions = [
        { label: 'Every 1 hour', value: '1' },
        { label: 'Every 3 hours', value: '3' },
        { label: 'Every 6 hours', value: '6' },
        { label: 'Every 12 hours', value: '12' },
        { label: 'Every 24 hours', value: '24' },
    ];

    const handleSave = () => {
        fetcher.submit(
            {
                checkFrequency: frequency,
                marginThreshold: threshold,
                paymentProcessorFee: fee,
                emailAlerts: emailEnabled.toString(),
                alertEmail: alertEmail,
                globalAutoReprice: autoReprice.toString(),
                globalAutoOos: autoOos.toString(),
                dailyDigestEnabled: digestEnabled.toString(),
                priceDropAlerts: priceDropEnabled.toString(),
            },
            { method: "post" }
        );
    };

    return (
        <Page title="Settings" backAction={{ content: "Dashboard", url: "/app" }}>
            <Layout>
                <Layout.Section>
                    {showSuccess && (
                        <div style={{ marginBottom: '16px' }}>
                            <Banner title="Settings saved successfully" tone="success" />
                        </div>
                    )}
                    <Card>
                        <BlockStack gap="500">
                            <Text as="h2" variant="headingMd">General Monitoring</Text>
                            <Select
                                label="Check Frequency"
                                options={frequencyOptions}
                                onChange={setFrequency}
                                value={frequency}
                            />
                            <TextField
                                label="Global Margin Alert Threshold (%)"
                                type="number"
                                value={threshold}
                                onChange={setThreshold}
                                autoComplete="off"
                                helpText="Default threshold for new products added to the app."
                            />
                            <TextField
                                label="Payment Processor Fee (%)"
                                type="number"
                                value={fee}
                                onChange={setFee}
                                autoComplete="off"
                                helpText="Included in margin calculations (e.g., Shopify Payments, PayPal)."
                            />

                            <Divider />

                            <Text as="h2" variant="headingMd">Automations & Global Sync</Text>
                            <BlockStack gap="200">
                                <Checkbox
                                    label="Enable Global Auto-Repricing"
                                    checked={autoReprice}
                                    onChange={setAutoReprice}
                                    helpText="If off, no Shopify prices will be updated automatically, even if individuals are enabled."
                                />
                                <Checkbox
                                    label="Enable Global Auto-OOS Sync"
                                    checked={autoOos}
                                    onChange={setAutoOos}
                                    helpText="If off, inventory will not be synced to 0 when suppliers go out of stock."
                                />
                            </BlockStack>

                            <Divider />

                            <Text as="h2" variant="headingMd">Notifications & Alerts</Text>
                            <Checkbox
                                label="Master Email Alerts"
                                checked={emailEnabled}
                                onChange={setEmailEnabled}
                                helpText="Broadly enable or disable all email outgoing from the app."
                            />
                            <BlockStack gap="200" style={{ marginLeft: '24px' }}>
                                <Checkbox
                                    label="Price Drop Opportunities"
                                    checked={priceDropEnabled && emailEnabled}
                                    onChange={setPriceDropEnabled}
                                    disabled={!emailEnabled}
                                    helpText="Alert me when a supplier lowers their price (Profit Potential)."
                                />
                                <Checkbox
                                    label="Morning Daily Digest"
                                    checked={digestEnabled && emailEnabled}
                                    onChange={setDigestEnabled}
                                    disabled={!emailEnabled}
                                    helpText="A summary of total profit protected and checks performed."
                                />
                            </BlockStack>
                            <TextField
                                label="Alert Destination Email"
                                value={alertEmail}
                                onChange={setAlertEmail}
                                autoComplete="email"
                                disabled={!emailEnabled}
                                placeholder="merchant@store.com"
                            />

                            <Divider />

                            <InlineStack align="end">
                                <Button variant="primary" onClick={handleSave} loading={isSaving}>
                                    Save settings
                                </Button>
                            </InlineStack>
                        </BlockStack>
                    </Card>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
