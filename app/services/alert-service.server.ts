export interface AlertPayload {
    shop: string;
    shopifyTitle: string;
    previousPrice: number;
    newPrice: number;
    marginAtRisk: boolean;
    currentMargin: number;
}

export async function sendMarginAlert(payload: AlertPayload) {
    const { shop, shopifyTitle, previousPrice, newPrice, marginAtRisk, currentMargin } = payload;

    const message = `
    ⚠️ Alert for ${shopifyTitle}
    Supplier price changed from $${previousPrice} to $${newPrice}.
    Your current margin is ${currentMargin}%.
    ${marginAtRisk ? "🚨 ACTION REQUIRED: Your margin is below the defined threshold!" : ""}
  `;

    console.log(`[ALERT] [${shop}]: ${message}`);

    // In a real app, integrate with Resend/SendGrid/Shopify Notifications
    // try {
    //   await sendEmail({
    //     to: "merchant@example.com",
    //     subject: `[The 1% Supplier] Price Alert: ${shopifyTitle}`,
    //     body: message
    //   });
    // } catch (error) {
    //   console.error("Failed to send alert email", error);
    // }
}

export async function createInAppNotification(shop: string, message: string) {
    // Logic to store notification in DB for Dashboard display
    console.log(`[Shopify Notification] [${shop}]: ${message}`);
}
