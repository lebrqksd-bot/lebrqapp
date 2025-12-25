// Register a basic service worker for offline support on web
// Expo will pick up this file automatically during web builds.

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = '/service-worker.js';
    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        // Optional: listen for updates and prompt user to refresh
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              // If new content is available, we could notify user here
              // console.log('New content is available; please refresh.');
            }
          };
        };
      })
      .catch((error) => {
        console.warn('Service Worker registration failed:', error);
      });
  });
}
