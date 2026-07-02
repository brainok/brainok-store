import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const missingFirebaseKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID"
].filter((key) => !import.meta.env[key]);

const root = createRoot(document.getElementById("root")!);

if (missingFirebaseKeys.length > 0) {
  root.render(<MissingConfig missingKeys={missingFirebaseKeys} />);
} else {
  import("./App").then(({ App }) => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
}

function MissingConfig({ missingKeys }: { missingKeys: string[] }) {
  return (
    <main className="page-shell">
      <section className="setup-panel">
        <span className="brand-mark" aria-hidden="true">
          <img src="/brainok-store-front-icon.png" alt="" />
        </span>
        <h1>Firebase config is required</h1>
        <p>
          Add these variables in Netlify Site configuration, or create
          `web-netlify/.env` locally and restart Vite.
        </p>
        <pre>{missingKeys.join("\n")}</pre>
      </section>
    </main>
  );
}
