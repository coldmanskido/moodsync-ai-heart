-- CreateTable
CREATE TABLE "SupplierProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "currentPrice" REAL NOT NULL,
    "lastChecked" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TrackingEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "shopifyTitle" TEXT NOT NULL,
    "supplierProductId" TEXT NOT NULL,
    "costPerUnit" REAL NOT NULL,
    "shippingCost" REAL NOT NULL DEFAULT 0,
    "marginThreshold" REAL NOT NULL DEFAULT 20,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrackingEntry_supplierProductId_fkey" FOREIGN KEY ("supplierProductId") REFERENCES "SupplierProduct" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierProductId" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceHistory_supplierProductId_fkey" FOREIGN KEY ("supplierProductId") REFERENCES "SupplierProduct" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierProduct_url_key" ON "SupplierProduct"("url");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingEntry_shopifyProductId_key" ON "TrackingEntry"("shopifyProductId");

-- CreateIndex
CREATE INDEX "TrackingEntry_shop_idx" ON "TrackingEntry"("shop");

-- CreateIndex
CREATE INDEX "PriceHistory_supplierProductId_idx" ON "PriceHistory"("supplierProductId");
