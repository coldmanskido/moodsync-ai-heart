import prisma from "../db.server";

export type NotificationType = "MARGIN_ALERT" | "OOS_ALERT" | "SCRAPER_ERROR" | "PRICE_CHANGE";

export async function createNotification(params: {
    shop: string;
    type: NotificationType;
    productId?: string;
    message: string;
    severity: "info" | "warning" | "critical";
}) {
    return await prisma.notification.create({
        data: params,
    });
}

export async function getUnreadCount(shop: string) {
    return await prisma.notification.count({
        where: {
            shop,
            read: false,
        },
    });
}

export async function getNotifications(shop: string, limit = 50) {
    return await prisma.notification.findMany({
        where: { shop },
        orderBy: { createdAt: "desc" },
        take: limit,
    });
}

export async function markAsRead(id: string) {
    return await prisma.notification.update({
        where: { id },
        data: { read: true },
    });
}

export async function markAllAsRead(shop: string) {
    return await prisma.notification.updateMany({
        where: { shop, read: false },
        data: { read: true },
    });
}
