import { Page, Layout, EmptyState } from "@shopify/polaris";

export default function CompetitorSpy() {
    return (
        <Page title="Competitor Spy">
            <Layout>
                <Layout.Section>
                    <EmptyState
                        heading="Track your competition"
                        action={{ content: 'Add Competitor', onAction: () => console.log('todo') }}
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                        <p>Monitor competitor pricing and stock levels in real-time. (Coming Soon)</p>
                    </EmptyState>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
