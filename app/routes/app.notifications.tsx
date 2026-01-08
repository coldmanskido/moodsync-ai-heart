import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
    Page,
    Layout,
    Card,
    ResourceList,
    ResourceItem,
    Text,
    Badge,
    Button,
    InlineStack,
    BlockStack,
    EmptyState,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getNotifications, markAsRead, markAllAsRead } from "../services/notification.server";
import { AlertCircleIcon, InfoIcon, AlertTriangleIcon } from "@shopify/polaris-icons";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { session } = await authenticate.admin(request);
    const notifications = await getNotifications(session.shop);
    return json({ notifications });
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const { session } = await authenticate.admin(request);
    const formData = await request.formData();
    const actionType = formData.get("actionType");

    if (actionType === "clearAll") {
        await markAllAsRead(session.shop);
        return json({ status: "success" });
    }

    if (actionType === "markRead") {
        const id = formData.get("id") as string;
        await markAsRead(id);
        return json({ status: "success" });
    }

    return json({ status: "error" }, { status: 400 });
};

export default function NotificationsPage() {
    const { notifications } = useLoaderData<typeof loader>();
    const fetcher = useFetcher();

    const handleClearAll = () => {
        fetcher.submit({ actionType: "clearAll" }, { method: "post" });
    };

    const handleMarkRead = (id: string) => {
        fetcher.submit({ actionType: "markRead", id }, { method: "post" });
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case "critical": return AlertCircleIcon;
            case "warning": return AlertTriangleIcon;
            default: return InfoIcon;
        }
    };

    const getSeverityTone = (severity: string) => {
        switch (severity) {
            case "critical": return "critical";
            case "warning": return "warning";
            default: return "info";
        }
    };

    return (
        <Page
            title="Notifications"
            primaryAction={{
                content: "Clear All",
                onAction: handleClearAll,
                disabled: notifications.length === 0,
            }}
        >
            <Layout>
                <Layout.Section>
                    {notifications.length === 0 ? (
                        <Card>
                            <EmptyState
                                heading="No new notifications"
                                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                            >
                                <p>We'll notify you here when important events happen, like margin drops or out-of-stock alerts.</p>
                            </EmptyState>
                        </Card>
                    ) : (
                        <Card padding="0">
                            <ResourceList
                                resourceName={{ singular: "notification", plural: "notifications" }}
                                items={notifications}
                                renderItem={(item) => {
                                    const { id, message, type, severity, read, createdAt } = item;
                                    return (
                                        <ResourceItem
                                            id={id}
                                            onClick={() => handleMarkRead(id)}
                                            persistActions
                                        >
                                            <InlineStack gap="400" align="space-between" blockAlign="center">
                                                <InlineStack gap="300" blockAlign="center">
                                                    <div style={{ padding: '8px', background: read ? '#f1f1f1' : '#e7f1ef', borderRadius: '50%' }}>
                                                        <Badge
                                                            icon={getSeverityIcon(severity)}
                                                            tone={getSeverityTone(severity)}
                                                        />
                                                    </div>
                                                    <BlockStack gap="100">
                                                        <InlineStack gap="200" blockAlign="center">
                                                            <Text variant="bodyMd" fontWeight={read ? "regular" : "bold"} as="p">
                                                                {message}
                                                            </Text>
                                                            {!read && <Badge tone="attention" size="small">New</Badge>}
                                                        </InlineStack>
                                                        <Text variant="bodySm" tone="subdued" as="p">
                                                            {new Date(createdAt).toLocaleString()} • {type.replace("_", " ")}
                                                        </Text>
                                                    </BlockStack>
                                                </InlineStack>
                                                {!read && (
                                                    <Button variant="plain" onClick={() => handleMarkRead(id)}>
                                                        Mark as read
                                                    </Button>
                                                )}
                                            </InlineStack>
                                        </ResourceItem>
                                    );
                                }}
                            />
                        </Card>
                    )}
                </Layout.Section>
            </Layout>
        </Page>
    );
}
