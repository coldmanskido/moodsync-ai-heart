import { vi } from "vitest";
import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock("../shopify.server", () => ({
  authenticate: {
    admin: vi.fn().mockResolvedValue({
      session: { shop: "test-shop.myshopify.com" },
      admin: {
        graphql: vi.fn().mockResolvedValue({
          json: vi.fn().mockResolvedValue({ data: { nodes: [] } }),
        }),
      },
    }),
  },
}));

vi.mock("../db.server", () => ({
  default: {
    trackingEntry: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
    },
    supplierProduct: {
      update: vi.fn().mockResolvedValue(null),
    },
  },
}));
