// 1. Listen for the 'push' event from the server
self.addEventListener('push', function (event) {
  // Parse the JSON payload we sent from the Deno Edge Function
  const data = event.data ? event.data.json() : {};
  
  const title = data.title || "Драконий Центр Связи";
  const options = {
    body: data.body || "Новое сообщение!",
    icon: data.icon || "/pwa-192x192.png",
    data: { url: data.url || "/" } // Save the URL so we know where to go when clicked
  };

  // Tell the Operating System to show the banner
  event.waitUntil(self.registration.showNotification(title, options));
});

// 2. Listen for when the user taps the notification banner
self.addEventListener('notificationclick', function (event) {
  event.notification.close(); // Close the banner
  
  // Open the app to the specific URL
  event.waitUntil(clients.openWindow(event.notification.data.url));
});