import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function PWAManager() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    let manifest = '/manifest-admin.json';
    let icon = '/logo.png';
    
    if (path.includes('motoboy')) {
      manifest = '/manifest-motoboy.json';
      icon = '/motoboy_pwa.png';
    } else if (path.startsWith('/s/')) {
      manifest = '/manifest.json';
    }

    // Update Manifest
    let manifestLink = document.getElementById('manifest-link') as HTMLLinkElement;
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      manifestLink.id = 'manifest-link';
      document.head.appendChild(manifestLink);
    }
    if (manifestLink.href !== window.location.origin + manifest) {
      manifestLink.href = manifest;
    }

    // Update Apple Touch Icon
    let appleIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
    if (!appleIcon) {
      appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      document.head.appendChild(appleIcon);
    }
    appleIcon.href = icon;

    // Update Favicon
    let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      favicon.type = 'image/png';
      document.head.appendChild(favicon);
    }
    favicon.href = icon;
  }, [location.pathname]);

  return null;
}
