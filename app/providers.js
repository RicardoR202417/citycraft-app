"use client";

import { Toaster } from "sileo";

export function Providers({ children }) {
  return (
    <>
      <Toaster
        position="top-right"
        offset={{ top: 18, right: 18 }}
        theme="system"
        options={{
          fill: "var(--toast-fill)",
          roundness: 8,
          styles: {
            title: "cityToastTitle",
            description: "cityToastDescription",
            badge: "cityToastBadge",
            button: "cityToastButton"
          }
        }}
      />
      {children}
    </>
  );
}
