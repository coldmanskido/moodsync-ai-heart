import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
    Page,
    Layout,
    Card,
    IndexTable,
    Text,
    Badge,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    await authenticate.admin(request);

    // Mock data for MVP
    const alerts = [
        {
            id: "1",
            date: "2026-01-04 14:30",
            product: "Oxygen Snowboard",
            change: "+$12.50",
            impact: "-14%",
            status: "Critical",
        },
        {
            id: "2",
            date: "2026-01-04 10:15",
            product: "Classic Snowboard",
            change: "-$2.00",
            impact: "+2.5%",
            status: "Info",
        },
    ];

    return json({ alerts });
};

export default function AlertsLog() {
    const { alerts } = useLoaderData<typeof loader>();

    const resourceName = {
        singular: 'alert',
        plural: 'alerts',
    };

    const rowMarkup = alerts.map(
        ({ id, date, product, change, impact, status }, index) => (
            <IndexTable.Row id={id} key={id} position={index}>
                <IndexTable.Cell>{date}</IndexTable.Cell>
                <IndexTable.Cell>
                    <Text variant="bodyMd" fontWeight="bold" as="span">
                        {product}
                    </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                    <Text tone={change.startsWith("+") ? "critical" : "success"} as="span">
                        {change}
                    </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>{impact}</IndexTable.Cell>
                <IndexTable.Cell>
                    <Badge tone={status === "Critical" ? "critical" : "info"}>{status}</Badge>
                </IndexTable.Cell>
            </IndexTable.Row>
        ),
    );

    return (
        <Page title="Alerts Log" backAction={{ content: "Dashboard", url: "/app" }}>
            <Layout>
                <Layout.Section>
                    <Card padding="0">
                        <IndexTable
                            resourceName={resourceName}
                            itemCount={alerts.length}
                            headings={[
                                { title: 'Date' },
                                { title: 'Product' },
                                { title: 'Price Change' },
                                { title: 'Margin Impact' },
                                { title: 'Status' },
                            ]}
                            selectable={false}
                        >
                            {rowMarkup}
                        </IndexTable>
                    </Card>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
