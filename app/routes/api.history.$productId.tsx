import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
    await authenticate.admin(request);
    const { productId } = params;

    if (!productId) {
        return json({ error: "Missing product ID" }, { status: 400 });
    }

    const history = await prisma.priceHistory.findMany({
        where: {
            supplierProduct: {
                tracking: {
                    some: { id: productId }
                }
            }
        },
        orderBy: { timestamp: 'asc' },
        take: 30
    });

    const chartData = history.map(h => ({
        date: new Date(h.timestamp).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        price: h.price
    }));

    return json({ history: chartData });
};
