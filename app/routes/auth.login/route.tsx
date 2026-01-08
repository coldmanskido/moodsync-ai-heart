import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import {
  AppProvider as PolarisAppProvider,
  Button,
  Card,
  FormLayout,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { login } from "../../shopify.server";

import { loginErrorMessage } from "./error.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return { errors, polarisTranslations };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return {
    errors,
  };
};

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [shop, setShop] = useState("");
  const { errors } = actionData || loaderData;

  return (
    <PolarisAppProvider i18n={loaderData.polarisTranslations}>
      <Page>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '10vh' }}>
          <img
            src="https://cdn.shopify.com/s/files/1/0785/3319/8076/files/favicon_ico.png?v=1767725055"
            alt="1% Supplier Logo"
            style={{ width: '100px', height: '100px', marginBottom: '32px' }}
          />
          <Card>
            <div style={{ padding: '24px', width: '400px' }}>
              <Form method="post">
                <FormLayout>
                  <Text variant="headingLg" as="h1" alignment="center">
                    Enter the Situation Room
                  </Text>
                  <Text variant="bodyMd" as="p" alignment="center" tone="subdued">
                    The 1% Supplier Defense App
                  </Text>
                  <TextField
                    type="text"
                    name="shop"
                    label="Enter your Shop Domain"
                    placeholder="example.myshopify.com"
                    value={shop}
                    onChange={setShop}
                    autoComplete="on"
                    error={errors.shop}
                  />
                  <Button submit variant="primary" fullWidth size="large">
                    Enter
                  </Button>
                </FormLayout>
              </Form>
            </div>
          </Card>
          <div style={{ marginTop: '32px', color: '#666' }}>
            &copy; 2026 1% Supplier Defense App
          </div>
        </div>
      </Page>
    </PolarisAppProvider>
  );
}
