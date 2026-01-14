import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Index, { loader } from "./app._index";
import { json } from "@remix-run/node";

import { AppProvider } from "@shopify/polaris";

// Mocks for Remix hooks
vi.mock("@remix-run/react", async () => {
  const actual = await vi.importActual("@remix-run/react");
  return {
    ...actual,
    useLoaderData: vi.fn(),
    useFetcher: vi.fn().mockReturnValue({
      submit: vi.fn(),
      state: "idle",
      data: null,
    }),
    useRevalidator: vi.fn().mockReturnValue({
      revalidate: vi.fn(),
    }),
  };
});

// Mock server response
const mockProduct = {
  id: "1",
  name: "Test Product",
  supplierPrice: 10.0,
  margin: 50,
  status: "Safe",
  lastChecked: new Date().toLocaleString(),
};

const loaderData = {
  monitoredProducts: [mockProduct],
  shopName: "test-shop",
  stats: {
    totalMonitored: 1,
    atRisk: 0,
    avgMargin: "50.0",
  },
};

describe("Index Page", () => {
  it("renders the dashboard with a monitored product", async () => {
    const { useLoaderData } = await import("@remix-run/react");
    useLoaderData.mockReturnValue(loaderData);

    render(
      <AppProvider i18n={{}}>
        <Index />
      </AppProvider>
    );

    expect(screen.getByText((content, element) => {
      const hasText = (node) => node.textContent === "Welcome back, test-shop";
      const elementHasText = hasText(element);
      const childrenDontHaveText = Array.from(element.children).every(
        (child) => !hasText(child)
      );
      return elementHasText && childrenDontHaveText;
    })).toBeInTheDocument();

    expect(screen.getByText("Test Product")).toBeInTheDocument();
    expect(screen.getByText("$10.00")).toBeInTheDocument();
  });
});
