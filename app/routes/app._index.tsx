import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  InlineStack,
  Badge,
  Button,
  Icon,
  EmptyState,
  Spinner
} from "@shopify/polaris";
import { ChartVerticalIcon, AlertCircleIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  // Fetch Real Data without full history for performance
  const trackingEntries = await prisma.trackingEntry.findMany({
    include: {
      supplierProduct: true,
    },
    orderBy: { updatedAt: "desc" }
  });

  // Fetch Shopify prices if needed (batch query for efficiency)
  const productIds = trackingEntries.map(e => e.shopifyProductId);
  const shopifyPrices: Record<string, number> = {};

  if (productIds.length > 0) {
    try {
      const response = await admin.graphql(`
        query getProductPrices($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
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
      `, {
        variables: { ids: productIds }
      });

      const data = await response.json();
      if (data.data?.nodes) {
        data.data.nodes.forEach((node: any) => {
          if (node?.id && node?.variants?.edges?.[0]?.node?.price) {
            shopifyPrices[node.id] = parseFloat(node.variants.edges[0].node.price);
          }
        });
      }
    } catch (error) {
      console.error("Failed to fetch Shopify prices:", error);
    }
  }

  const monitoredProducts = trackingEntries.map((entry) => {
    const currentTotalCost = entry.supplierProduct.currentPrice + entry.shippingCost;

    // Use real Shopify price, fallback to cached, fallback to 0
    const sellingPrice = shopifyPrices[entry.shopifyProductId]
      || entry.lastKnownSellingPrice
      || 0;

    const margin = sellingPrice > 0
      ? ((sellingPrice - currentTotalCost) / sellingPrice) * 100
      : 0;

    const isRisk = margin < entry.marginThreshold;


    // Update cached price in background (fire and forget)
    if (shopifyPrices[entry.shopifyProductId] && shopifyPrices[entry.shopifyProductId] !== entry.lastKnownSellingPrice) {
      prisma.trackingEntry.update({
        where: { id: entry.id },
        data: {
          lastKnownSellingPrice: shopifyPrices[entry.shopifyProductId],
          lastPriceSyncAt: new Date()
        }
      }).catch(console.error);
    }

    return {
      id: entry.id,
      name: entry.shopifyTitle,
      supplierPrice: entry.supplierProduct.currentPrice,
      sellingPrice: sellingPrice,
      margin: parseFloat(margin.toFixed(1)),
      status: isRisk ? "At Risk" : "Safe",
      lastChecked: new Date(entry.supplierProduct.lastChecked).toLocaleString(),
      url: entry.supplierProduct.url,
      isPriceStale: !entry.lastPriceSyncAt || (Date.now() - entry.lastPriceSyncAt.getTime() > 24 * 60 * 60 * 1000)
    };
  });

  // Calculate Stats
  const totalMonitored = monitoredProducts.length;
  const atRisk = monitoredProducts.filter(p => p.status === "At Risk").length;
  const avgMargin = totalMonitored > 0
    ? (monitoredProducts.reduce((acc, p) => p.margin + acc, 0) / totalMonitored).toFixed(1)
    : "0.0";

  return json({
    monitoredProducts,
    shopName: session.shop.replace(".myshopify.com", ""),
    stats: {
      totalMonitored,
      atRisk,
      avgMargin,
    },
  });
};

// 4. Lazy Chart Component
function LazyChart({ productId }: { productId: string }) {
  const fetcher = useFetcher<any>();

  useEffect(() => {
    if (fetcher.state === 'idle' && !fetcher.data) {
      fetcher.load(`/api/history/${productId}`);
    }
  }, [productId, fetcher]);

  if (fetcher.state === 'loading') {
    return (
      <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size="large" />
      </div>
    );
  }

  const history = fetcher.data?.history || [];
  const hasEnoughData = history.length > 1;

  if (!hasEnoughData) {
    return (
      <div style={{ padding: "40px", textAlign: "center", background: "#fff", borderRadius: "8px", border: "1px dashed #ccc" }}>
        <InlineStack gap="200" align="center">
          <Icon source={AlertCircleIcon} tone="subdued" />
          <Text as="p" tone="subdued">Not enough data to generate chart yet. Wait for the scraper to run a few more times.</Text>
        </InlineStack>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 300, background: "#fff", padding: "10px", borderRadius: "8px" }}>
      <ResponsiveContainer>
        <LineChart data={history} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" fontSize={12} tickMargin={10} />
          <YAxis domain={['auto', 'auto']} fontSize={12} />
          <Tooltip
            contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}
            labelStyle={{ color: "#666" }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#008060"
            strokeWidth={3}
            dot={{ r: 4, fill: "#008060" }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MonitoredProductRow({ product, index, isExpanded, toggleRow }: any) {
  return (
    <div key={product.id} style={{ borderBottom: "1px solid #e1e3e5" }}>
      {/* Main Row */}
      <div
        style={{
          padding: "16px",
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr",
          gap: "16px",
          alignItems: "center",
          cursor: "pointer",
          transition: "background 0.2s",
          background: isExpanded ? "#f6f6f7" : "transparent"
        }}
        onClick={() => toggleRow(product.id)}
        onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = "#fafbfb"; }}
        onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = "transparent"; }}
      >
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {product.name}
        </Text>
        <Text as="span">${product.supplierPrice.toFixed(2)}</Text>
        <Text tone={product.margin < 20 ? "critical" : "success"} as="span">
          {product.margin}%
        </Text>
        <Badge tone={product.status === "Safe" ? "success" : "critical"}>{product.status}</Badge>
        <Button
          variant="plain"
          icon={ChartVerticalIcon}
          onClick={(e) => { e.stopPropagation(); toggleRow(product.id); }}
        >
          {isExpanded ? "Hide" : "Chart"}
        </Button>
        <Text as="span" tone="subdued" variant="bodySm">{product.lastChecked}</Text>
      </div>

      {/* Expandable Chart Section */}
      {isExpanded && (
        <div style={{ padding: "20px", background: "#f9fafb", borderTop: "1px solid #e1e3e5" }}>
          <BlockStack gap="400">
            <Text as="h3" variant="headingSm">Price History (30 Days)</Text>
            <LazyChart productId={product.id} />
          </BlockStack>
        </div>
      )}
    </div>
  );
}

export default function Index() {
  // 3. Stats Data
  const { monitoredProducts, shopName, stats } = useLoaderData<typeof loader>();
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    const newExpandedRowIds = new Set(expandedRowIds);
    if (newExpandedRowIds.has(id)) {
      newExpandedRowIds.delete(id);
    } else {
      newExpandedRowIds.add(id);
    }
    setExpandedRowIds(newExpandedRowIds);
  };

  return (
    <Page title="Dashboard" fullWidth>
      <BlockStack gap="600">
        <style>{`
          @keyframes slideInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .monitored-row {
            transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            animation: slideInUp 0.4s ease forwards;
            opacity: 0;
          }
          .monitored-row:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            z-index: 10;
          }
          .brand-accent {
             background: linear-gradient(135deg, #008060 0%, #005e46 100%);
             -webkit-background-clip: text;
             -webkit-text-fill-color: transparent;
          }
        `}</style>

        {/* 1. Branded Welcome Header */}
        <Card>
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <InlineStack gap="300" blockAlign="center">
                <div style={{ padding: '8px', background: '#f1f2f3', borderRadius: '12px', border: '1px solid #e1e3e5' }}>
                  <img src="https://cdn.shopify.com/s/files/1/0785/3319/8076/files/favicon_ico.png?v=1767725055" alt="Logo" style={{ width: '40px', height: '40px', display: 'block', objectFit: 'contain' }} />
                </div>
                <div>
                  <Text as="h1" variant="headingXl">
                    Welcome back, <span className="brand-accent">{shopName}</span>
                  </Text>
                  <Text as="p" tone="subdued" variant="bodyLg">
                    Your 1% Profit Defense is <Badge tone="success">Operational</Badge>
                  </Text>
                </div>
              </InlineStack>
            </BlockStack>
            <Button variant="primary" url="/app/bulk">Manage Tracking</Button>
          </InlineStack>
        </Card>

        {/* 2. Top Stats */}
        <Layout>
          <Layout.Section>
            <InlineStack gap="400" align="start" blockAlign="stretch">
              <div style={{ flex: 1 }}>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingSm" tone="subdued">Monitored Products</Text>
                    <Text as="p" variant="headingLg">{stats.totalMonitored}</Text>
                  </BlockStack>
                </Card>
              </div>
              <div style={{ flex: 1 }}>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingSm" tone="subdued">Margin Risk</Text>
                    <InlineStack gap="200" align="start">
                      <Text as="p" variant="headingLg" tone={stats.atRisk > 0 ? "critical" : "success"}>
                        {stats.atRisk}
                      </Text>
                      {stats.atRisk > 0 && <Badge tone="critical">Action Needed</Badge>}
                    </InlineStack>
                  </BlockStack>
                </Card>
              </div>
              <div style={{ flex: 1 }}>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingSm" tone="subdued">Avg. Margin (Est)</Text>
                    <Text as="p" variant="headingLg">{stats.avgMargin}%</Text>
                  </BlockStack>
                </Card>
              </div>
            </InlineStack>
          </Layout.Section>

          {/* 3. Main Table */}
          <Layout.Section>
            <Card padding="0">
              {monitoredProducts.length === 0 ? (
                <EmptyState
                  heading="No products monitored yet"
                  action={{ content: 'Start Monitoring', url: '/app/bulk' }}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Go to the Bulk Editor to link your products to AliExpress and enable Auto-Defense.</p>
                </EmptyState>
              ) : (
                <>
                  {/* Table Header */}
                  <div style={{
                    padding: "16px",
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr",
                    gap: "16px",
                    background: "#f6f6f7",
                    borderBottom: "2px solid #e1e3e5",
                    fontWeight: 600
                  }}>
                    <Text as="span" variant="headingSm">Product</Text>
                    <Text as="span" variant="headingSm">Supplier Price</Text>
                    <Text as="span" variant="headingSm">Est. Margin</Text>
                    <Text as="span" variant="headingSm">Status</Text>
                    <Text as="span" variant="headingSm">Actions</Text>
                    <Text as="span" variant="headingSm">Last Checked</Text>
                  </div>

                  {/* Table Rows */}
                  {monitoredProducts.map((product, index) => (
                    <MonitoredProductRow
                      key={product.id}
                      product={product}
                      index={index}
                      isExpanded={expandedRowIds.has(product.id)}
                      toggleRow={toggleRow}
                    />
                  ))}
                </>
              )}
            </Card>
            <div style={{ marginTop: "20px", textAlign: "center" }}>
              <Text as="p" tone="subdued" variant="bodyXs">Displaying recent price checks. Auto-updates every hour.</Text>
            </div>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
