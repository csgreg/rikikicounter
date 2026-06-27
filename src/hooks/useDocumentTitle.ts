import { useEffect } from "react";

// Update the page <title> per route (helps SEO + browser tabs in an SPA).
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
