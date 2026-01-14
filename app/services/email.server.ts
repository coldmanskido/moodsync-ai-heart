import { type Notification } from "@prisma/client";

interface MarginAlertData {
    productTitle: string;
    productImage: string;
    currentMargin: number;
    threshold: number;
    currentCost: number;
    currentPrice: number;
    suggestedPrice: number;
}

interface OOSAlertData {
    productTitle: string;
    productImage: string;
}

interface PriceDropData {
    productTitle: string;
    productImage: string;
    oldCost: number;
    newCost: number;
    marginIncrease: number;
}

interface DailyDigestData {
    profitProtected: number;
    checksPerformed: number;
    priceAdjustments: number;
    criticalAlerts: number;
}

interface ScraperHealthData {
    productTitle: string;
    url: string;
    errorCode: string;
}

const LOGO_URL = "https://cdn.shopify.com/s/files/1/0785/3319/8076/files/favicon_ico.png?v=1767725055";
const COMPLIANCE_FOOTER = `
    <div class="footer">
        <p>&copy; 2026 1% Supplier Defense App</p>
        <p>You received this because you enabled Email Alerts in your Store Settings.</p>
        <p>123 Commerce St, Suite 100, New York, NY 10001</p>
    </div>
`;

const COMMON_STYLES = `
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f6f6f7; padding: 40px 0; margin: 0; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { color: white; padding: 32px; text-align: center; }
    .header-logo { width: 50px; height: 50px; margin-bottom: 12px; }
    .content { padding: 32px; color: #202223; line-height: 1.5; }
    .product-card { border: 1px solid #e1e3e5; border-radius: 8px; padding: 16px; display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
    .product-img { width: 80px; height: 80px; object-fit: cover; border-radius: 4px; }
    .cta { display: block; text-align: center; padding: 14px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 24px; }
    .footer { padding: 24px; text-align: center; font-size: 12px; color: #6d7175; border-top: 1px solid #e1e3e5; margin-top: 20px; }
`;

async function sendWithResend(to: string, subject: string, html: string) {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey || apiKey === "re_...") {
        console.log(`[EMAIL-DEBUG] No API Key. Skipping Resend for: ${subject} to ${to}`);
        console.log(`[EMAIL-DEBUG] HTML Preview: ${html.substring(0, 100)}...`);
        return { success: true, simulated: true };
    }

    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: "1% Supplier <alerts@the1percentsupplier.shop>",
                to: [to],
                subject: subject,
                html: html,
            }),
        });

        const data = await response.json();
        if (response.ok) {
            console.log(`[EMAIL-SUCCESS] Sent via Resend: ${subject} to ${to} (ID: ${data.id})`);
            return { success: true, id: data.id };
        } else {
            console.error(`[EMAIL-ERROR] Resend failed:`, data);
            return { success: false, error: data };
        }
    } catch (error) {
        console.error(`[EMAIL-EXCEPTION] Failed to send via Resend:`, error);
        return { success: false, error };
    }
}

export async function sendMarginAlertEmail(to: string, data: MarginAlertData) {
    const subject = `⚠️ Margin Risk Alert: ${data.productTitle}`;
    const html = `
    <!DOCTYPE html>
    <html>
    <head><style>${COMMON_STYLES} .header { background: #8e1f0b; } .cta { background: #8e1f0b; color: white; }</style></head>
    <body>
    <div class="container">
            <div class="header">
                <img src="${LOGO_URL}" class="header-logo" />
                <h1>Margin Risk Alert ⚠️</h1>
            </div>
            <div class="content">
                <p>One of your products has fallen below your <strong>${data.threshold}%</strong> margin threshold.</p>
                <div class="product-card">
                    <img src="${data.productImage}" class="product-img" />
                    <div>
                        <strong style="font-size: 16px;">${data.productTitle}</strong>
                        <p style="margin: 4px 0; color: #6d7175;">Current Retail: $${data.currentPrice.toFixed(2)}</p>
                    </div>
                </div>
                <div style="background: #fff4f4; border: 1px solid #ffc1c1; color: #8e1f0b; padding: 16px; border-radius: 6px;">
                    <strong>Critical Margin Drop: ${data.currentMargin.toFixed(1)}%</strong>
                </div>
                <p>Suggested Action: Increase your price to <strong>$${data.suggestedPrice.toFixed(2)}</strong>.</p>
                <a href="https://admin.shopify.com" class="cta">Update Price Now</a>
            </div>
            ${COMPLIANCE_FOOTER}
        </div>
    </body>
    </html>
    `;
    return await sendWithResend(to, subject, html);
}

export async function sendPriceDropEmail(to: string, data: PriceDropData) {
    const subject = `🤑 Profit Opportunity: ${data.productTitle}`;
    const html = `
    <!DOCTYPE html>
    <html>
    <head><style>${COMMON_STYLES} .header { background: #008060; } .cta { background: #008060; color: white; }</style></head>
    <body>
    <div class="container">
            <div class="header">
                <img src="${LOGO_URL}" class="header-logo" />
                <h1>Profit Opportunity! 🤑</h1>
            </div>
            <div class="content">
                <p>Good news! A supplier lowered their price, increasing your potential profit.</p>
                <div class="product-card">
                    <img src="${data.productImage}" class="product-img" />
                    <div>
                        <strong>${data.productTitle}</strong>
                        <p style="margin: 4px 0;">Cost dropped from $${data.oldCost.toFixed(2)} to $${data.newCost.toFixed(2)}</p>
                    </div>
                </div>
                <div style="background: #e7f1ef; border: 1px solid #bbe5b3; color: #004c3f; padding: 16px; border-radius: 6px;">
                    <strong>Margin Increase: +${data.marginIncrease.toFixed(1)}%</strong>
                </div>
                <a href="https://admin.shopify.com" class="cta">Review Product</a>
            </div>
            ${COMPLIANCE_FOOTER}
        </div>
    </body>
    </html>
    `;
    return await sendWithResend(to, subject, html);
}

export async function sendDailyDigestEmail(to: string, data: DailyDigestData) {
    const subject = `🛡️ Daily Defense Report`;
    const html = `
    <!DOCTYPE html>
    <html>
    <head><style>${COMMON_STYLES} .header { background: #202223; } .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px; }</style></head>
    <body>
    <div class="container">
            <div class="header">
                <img src="${LOGO_URL}" class="header-logo" />
                <h1>Daily Defense Report 🛡️</h1>
            </div>
            <div class="content">
                <div style="text-align: center; margin-bottom: 32px;">
                    <h2 style="font-size: 32px; color: #008060; margin: 0;">$${data.profitProtected.toFixed(2)}</h2>
                    <p style="color: #6d7175; margin: 4px 0;">Total Profit Protected Today</p>
                </div>
                <div class="stat-grid">
                    <div style="background: #f6f6f7; padding: 16px; border-radius: 8px; text-align: center;">
                        <strong style="font-size: 20px;">${data.checksPerformed}</strong>
                        <p style="font-size: 12px; margin: 4px 0;">Checks</p>
                    </div>
                    <div style="background: #f6f6f7; padding: 16px; border-radius: 8px; text-align: center;">
                        <strong style="font-size: 20px;">${data.priceAdjustments}</strong>
                        <p style="font-size: 12px; margin: 4px 0;">Adjustments</p>
                    </div>
                </div>
                <a href="https://admin.shopify.com" class="cta" style="background: #202223; color: white;">View Dashboard</a>
            </div>
            ${COMPLIANCE_FOOTER}
        </div>
    </body>
    </html>
    `;
    return await sendWithResend(to, subject, html);
}

export async function sendOOSAlertEmail(to: string, data: OOSAlertData) {
    const subject = `🛑 Supplier Out of Stock: ${data.productTitle}`;
    const html = `
    <!DOCTYPE html>
    <html>
    <head><style>${COMMON_STYLES} .header { background: #b98900; } .cta { background: #202223; color: white; }</style></head>
    <body>
    <div class="container">
            <div class="header">
                <img src="${LOGO_URL}" class="header-logo" />
                <h1>Supplier Out of Stock 🛑</h1>
            </div>
            <div class="content">
                <div class="product-card">
                    <img src="${data.productImage}" class="product-img" />
                    <strong>${data.productTitle}</strong>
                </div>
                <p>We've synced your Shopify inventory to 0 to prevent overselling.</p>
                <a href="https://admin.shopify.com" class="cta">Inventory Manager</a>
            </div>
            ${COMPLIANCE_FOOTER}
        </div>
    </body>
    </html>
    `;
    return await sendWithResend(to, subject, html);
}

export async function sendBackInStockEmail(to: string, data: OOSAlertData) {
    const subject = `📈 Back in Stock! ${data.productTitle}`;
    const html = `
    <!DOCTYPE html>
    <html>
    <head><style>${COMMON_STYLES} .header { background: #005bd3; } .cta { background: #005bd3; color: white; }</style></head>
    <body>
    <div class="container">
            <div class="header">
                <img src="${LOGO_URL}" class="header-logo" />
                <h1>Item Back in Stock! 📈</h1>
            </div>
            <div class="content">
                <div class="product-card">
                    <img src="${data.productImage}" class="product-img" />
                    <strong>${data.productTitle}</strong>
                </div>
                <p>Your supplier has stock again! We've restored your Shopify inventory level.</p>
                <a href="https://admin.shopify.com" class="cta">Resume Sales</a>
            </div>
            ${COMPLIANCE_FOOTER}
        </div>
    </body>
    </html>
    `;
    return await sendWithResend(to, subject, html);
}

export async function sendScraperHealthEmail(to: string, data: ScraperHealthData) {
    const subject = `🛠️ Scraper Alert: Broken Link for ${data.productTitle}`;
    const html = `
    <!DOCTYPE html>
    <html>
    <head><style>${COMMON_STYLES} .header { background: #ffea8a; color: #5c3e00; } .cta { background: #202223; color: white; }</style></head>
    <body>
    <div class="container">
            <div class="header" style="background: #ffea8a; color: #5c3e00;">
                <img src="${LOGO_URL}" class="header-logo" />
                <h1>Link Connection Lost 🛠️</h1>
            </div>
            <div class="content">
                <p>We can no longer monitor <strong>${data.productTitle}</strong> because the supplier link is broken or restricted.</p>
                <div style="background: #fff4f4; padding: 12px; font-family: monospace; border-radius: 4px;">Error: ${data.errorCode}</div>
                <a href="${data.url}" class="cta" style="background: #f6f6f7; color: #202223; border: 1px solid #e1e3e5;">Check Supplier Page</a>
            </div>
            ${COMPLIANCE_FOOTER}
        </div>
    </body>
    </html>
    `;
    return await sendWithResend(to, subject, html);
}

export async function sendWelcomeEmail(to: string, step: 1 | 2 | 3) {
    const steps = {
        1: { title: "Welcome to the 1%! 🚀", body: "You're now protected. First tip: Set your 'Global Margin Threshold' in settings." },
        2: { title: "Pro Tip: Auto-OOS Sync 🛡️", body: "Tired of manual inventory? Enable Auto-OOS to kill manual work." },
        3: { title: "Max Profit Strategy 🤑", body: "Check your Dashboard to find products where you can increase prices without losing margin." }
    };
    const subject = steps[step].title;
    const html = `
    <!DOCTYPE html>
    <html>
    <head><style>${COMMON_STYLES} .header { background: #008060; } .cta { background: #202223; color: white; }</style></head>
    <body>
    <div class="container">
            <div class="header">
                <img src="${LOGO_URL}" class="header-logo" />
                <h1>${steps[step].title}</h1>
            </div>
            <div class="content">
                <p>Hi there,</p>
                <p>${steps[step].body}</p>
                <a href="https://admin.shopify.com" class="cta">Level Up My Store</a>
            </div>
            ${COMPLIANCE_FOOTER}
        </div>
    </body>
    </html>
    `;
    return await sendWithResend(to, subject, html);
}
