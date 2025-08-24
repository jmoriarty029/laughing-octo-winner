// This service worker script runs in the background to handle push notifications.
// It uses the older "compat" libraries, which are required for service workers.
importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js");

// Use the exact same Firebase configuration as your main app.
const firebaseConfig = {
  apiKey: "AIzaSyD7h7fGXyPyLoOmBFsDF_BPNpylB916pMs",
  authDomain: "laughing-octo-winner.firebaseapp.com",
  projectId: "laughing-octo-winner",
  storageBucket: "laughing-octo-winner.firebasestorage.app",
  messagingSenderId: "929553672352",
  appId: "1:929553672352:web:46d4632a49fe56593bc1c5",
  measurementId: "G-ZDXCRP06WB"
};

// Initialize the Firebase app within the service worker.
firebase.initializeApp(firebaseConfig);

// Get an instance of Firebase Messaging to handle background messages.
const messaging = firebase.messaging();

// Add a handler for when a push notification is received while the app is in the background.
messaging.onBackgroundMessage((payload) => {
  console.log(
    "[firebase-messaging-sw.js] Received background message ",
    payload
  );

  // Customize the notification that will be shown to the user.
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/icons/icon-192.png", // Ensure you have this icon in your public/icons folder
  };

  // Use the browser's Service Worker API to show the notification.
  self.registration.showNotification(notificationTitle, notificationOptions);
});
