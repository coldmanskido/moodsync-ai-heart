import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { productId } = params;

  if (!productId) {
    return json({ error: "Product ID is required" }, { status: 400 });
  }

  // In a real app, you would have a service to scrape the supplier's website
  // For this example, we'll simulate a refresh with a random price change
  const trackingEntry = await prisma.trackingEntry.findUnique({
    where: { id: productId },
    include: { supplierProduct: true },
  });

  if (!trackingEntry) {
    return json({ error: "Product not found" }, { status: 404 });
  }

  const currentPrice = trackingEntry.supplierProduct.currentPrice;
  const priceChange = (Math.random() - 0.5) * 5; // -2.5 to +2.5 change
  const newPrice = Math.max(0.01, currentPrice + priceChange);

  await prisma.supplierProduct.update({
    where: { id: trackingEntry.supplierProductId },
    data: {
      currentPrice: newPrice,
      lastChecked: new Date(),
      history: {
        create: {
          price: newPrice,
        },
      },
    },
  });

  return json({ success: true, newPrice: newPrice.toFixed(2) });
};
