import { useEffect } from 'react';

/**
 * A custom hook to dynamically update page metadata like title,
 * theme color, and the web app manifest link.
 * @param {{title: string, manifest: string, themeColor: string}} meta
 */
export default function usePageMeta({ title, manifest, themeColor }) {
  useEffect(() => {
    // Update the document title
    document.title = title;

    // Find the manifest link tag in the document's head and update its href
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
      manifestLink.href = manifest;
    }

    // Find the theme-color meta tag and update its content
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.content = themeColor;
    }
  }, [title, manifest, themeColor]); // Rerun effect if any of these change
}
