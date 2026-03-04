import prisma from "../db.server";
import { fetchSupplierPrice } from "./supplier-monitor.server";
import { calculateMargin, isMarginAtRisk } from "./margin-calculator.server";
import { updateShopifyPrice } from "./repricer.server";
import { syncOutOfStock, syncInStock } from "./stock-guard.server";
import { createNotification } from "./notification.server";
import { sendMarginAlertEmail, sendOOSAlertEmail, sendPriceDropEmail, sendBackInStockEmail } from "./email.server";

export async function runPriceMonitoringBatch() {
    const productsToTrack = await prisma.trackingEntry.findMany({
        include: {
            supplierProduct: true
        }
    });

    const shopSettingsCache: Record<string, any> = {};

    for (const entry of productsToTrack) {
        try {
            if (!shopSettingsCache[entry.shop]) {
                const settings = await prisma.storeSettings.findUnique({
                    where: { shop: entry.shop }
                });
                shopSettingsCache[entry.shop] = settings || {
                    emailAlerts: false,
                    alertEmail: null,
                    marginThreshold: entry.marginThreshold,
                    paymentProcessorFee: 2.9,
                    globalAutoReprice: true,
                    globalAutoOos: true,
                    dailyDigestEnabled: true,
                    priceDropAlerts: true
                };
            }
            const settings = shopSettingsCache[entry.shop];

            const scrapeResult = await fetchSupplierPrice(entry.supplierProduct.url);

            if (!scrapeResult) {
                // ... (existing logic for scraper error)
                continue;
            }

            const { price: newPrice, isAvailable } = scrapeResult;
            const wasAvailable = entry.supplierProduct.currentPrice > 0; // Simplified check for now

            // 1. Handle Stock Sync
            if (!isAvailable) {
                // Existing OOS logic - Respect Global Kill-switch
                if (entry.autoStockSync && settings.globalAutoOos) {
                    await syncOutOfStock(entry.shop, entry.shopifyProductId);
                }
                if (settings.emailAlerts && settings.alertEmail) {
                    await sendOOSAlertEmail(settings.alertEmail, {
                        productTitle: entry.shopifyTitle,
                        productImage: entry.supplierProduct.url
                    });
                }
            } else if (isAvailable && !wasAvailable) {
                // VICTORY: Back in Stock! - Respect Global Kill-switch for inventory restore
                if (entry.autoStockSync && settings.globalAutoOos) {
                    await syncInStock(entry.shop, entry.shopifyProductId);
                }

                await createNotification({
                    shop: entry.shop,
                    type: "PRICE_CHANGE",
                    productId: entry.shopifyProductId,
                    message: `${entry.shopifyTitle} is back in stock!`,
                    severity: "info"
                });

                if (settings.emailAlerts && settings.alertEmail) {
                    await sendBackInStockEmail(settings.alertEmail, {
                        productTitle: entry.shopifyTitle,
                        productImage: entry.supplierProduct.url
                    });
                }
            }

            // 2. Handle Price Changes
            if (newPrice !== entry.supplierProduct.currentPrice) {
                const oldPrice = entry.supplierProduct.currentPrice;

                await prisma.supplierProduct.update({
                    where: { id: entry.supplierProductId },
                    data: {
                        currentPrice: newPrice,
                        lastChecked: new Date(),
                        priceHistory: { create: { price: newPrice } }
                    }
                });

                const costDiff = newPrice - oldPrice;
                const sellingPrice = entry.lastKnownSellingPrice || 100;

                const marginResult = calculateMargin({
                    sellingPrice: sellingPrice,
                    costPerUnit: newPrice,
                    shippingCost: entry.shippingCost,
                    paymentFeePercentage: settings.paymentProcessorFee
                });

                // A. OPPORTUNITY: Price Drop! - Respect Price Drop Alert toggle
                if (costDiff < 0) {
                    await createNotification({
                        shop: entry.shop,
                        type: "PRICE_CHANGE",
                        productId: entry.shopifyProductId,
                        message: `Profit Opportunity! Supplier lowered price for ${entry.shopifyTitle}.`,
                        severity: "info"
                    });

                    if (settings.emailAlerts && settings.alertEmail && settings.priceDropAlerts) {
                        await sendPriceDropEmail(settings.alertEmail, {
                            productTitle: entry.shopifyTitle,
                            productImage: entry.supplierProduct.url,
                            oldCost: oldPrice,
                            newCost: newPrice,
                            marginIncrease: Math.abs(costDiff / sellingPrice * 100)
                        });
                    }
                }
                // B. REPRICE: Price Increase + Auto Enable - Respect Global Kill-switch
                else if (entry.autoUpdatePrice && settings.globalAutoReprice && costDiff > 0) {
                    await updateShopifyPrice({
                        shop: entry.shop,
                        shopifyProductId: entry.shopifyProductId,
                        newCost: newPrice,
                        shippingCost: entry.shippingCost,
                        targetMarginPercent: entry.marginThreshold
                    });
                }
                // C. RISK: Margin dropped below threshold
                else if (isMarginAtRisk(marginResult.currentMarginPercentage, entry.marginThreshold)) {
                    await createNotification({
                        shop: entry.shop,
                        type: "MARGIN_ALERT",
                        productId: entry.shopifyProductId,
                        message: `Risky Margin! ${entry.shopifyTitle} dropped to ${marginResult.currentMarginPercentage.toFixed(1)}%.`,
                        severity: "critical"
                    });

                    if (settings.emailAlerts && settings.alertEmail) {
                        await sendMarginAlertEmail(settings.alertEmail, {
                            productTitle: entry.shopifyTitle,
                            productImage: entry.supplierProduct.url,
                            currentMargin: marginResult.currentMarginPercentage,
                            threshold: entry.marginThreshold,
                            currentCost: newPrice,
                            currentPrice: sellingPrice,
                            suggestedPrice: (newPrice + entry.shippingCost) / (1 - (entry.marginThreshold / 100) - (settings.paymentProcessorFee / 100))
                        });
                    }
                }
            } else {
                await prisma.supplierProduct.update({
                    where: { id: entry.supplierProductId },
                    data: { lastChecked: new Date() }
                });
            }
        } catch (error) {
            console.error(`Failed monitoring ${entry.shopifyTitle}:`, error);
        }
    }
}
