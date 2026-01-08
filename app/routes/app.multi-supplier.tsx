import { Page, Layout, EmptyState } from "@shopify/polaris";

export default function MultiSupplier() {
    return (
        <Page title="Multi-Supplier Backup">
            <Layout>
                <Layout.Section>
                    <EmptyState
                        heading="Never run out of stock"
                        action={{ content: 'Add Backup Supplier', onAction: () => console.log('todo') }}
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                        <p>Link multiple suppliers to a single product. If one goes OOS, we switch to the next. (Coming Soon)</p>
                    </EmptyState>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
