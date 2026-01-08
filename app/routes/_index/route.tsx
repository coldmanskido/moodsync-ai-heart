import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <img
            src="https://cdn.shopify.com/s/files/1/0785/3319/8076/files/favicon_ico.png?v=1767725055"
            alt="1% Supplier Logo"
            style={{ width: '80px', height: '80px', marginBottom: '20px' }}
          />
          <h1 className={styles.heading}>The 1% Supplier</h1>
          <p className={styles.text}>
            Precision Pricing & Inventory Defense for Elite Brands.
          </p>
        </div>

        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Enter your Shop Domain to enter the situation room:</span>
              <input
                className={styles.input}
                type="text"
                name="shop"
                placeholder="my-store.myshopify.com"
              />
            </label>
            <button className={styles.button} type="submit">
              Log in / Install
            </button>
          </Form>
        )}

        <div style={{ marginTop: '40px', color: '#666', fontSize: '0.9rem', textAlign: 'center' }}>
          &copy; 2026 1% Supplier Defense App. All rights reserved.
        </div>
      </div>
    </div>
  );
}
