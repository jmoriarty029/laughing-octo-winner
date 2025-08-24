import { useState, useEffect } from 'react';
import { getMessaging, getToken } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase'; // Assuming your firebase config is exported from here

// This component handles the logic for enabling push notifications.
export default function NotificationButton({ user }) {
  const [permission, setPermission] = useState(Notification.permission);

  // This function requests permission from the user
  async function requestPermission() {
    if (!('Notification' in window)) {
      console.log('This browser does not support desktop notification');
      return;
    }

    const newPermission = await Notification.requestPermission();
    setPermission(newPermission);

    if (newPermission === 'granted') {
      await saveMessagingDeviceToken();
    }
  }

  // This function saves the unique FCM token to Firestore
  async function saveMessagingDeviceToken() {
    try {
      const messaging = getMessaging();
      // You need to provide your VAPID key from the Firebase Console here
      const fcmToken = await getToken(messaging, { vapidKey: 'BIHmz65tUVlXiBrt-UCof6oMjdLZRmlveSRDa5IGC1_y1P8QYZAJMTAaV3RVJZmXaS5WcX4QrvkOgo948rDx0CA' });

      if (fcmToken) {
        console.log('FCM Token:', fcmToken);
        const tokenRef = doc(db, `fcmTokens/${fcmToken}`);
        // Associate the token with the current user
        await setDoc(tokenRef, { 
          uid: user.uid,
          createdAt: serverTimestamp() 
        });
        console.log('Token saved to Firestore.');
      } else {
        // Need to request permission to show notifications
        console.log('No registration token available. Request permission to generate one.');
        requestPermission();
      }
    } catch (error) {
      console.error('Unable to get messaging token.', error);
    }
  }

  // When the component loads for a logged-in user, check for the token
  useEffect(() => {
    if (user && permission === 'granted') {
      saveMessagingDeviceToken();
    }
  }, [user, permission]);

  if (!user || permission === 'granted') {
    return null; // Don't show the button if already granted or not logged in
  }

  if (permission === 'denied') {
    return <p className="text-xs text-center text-red-500 mt-4">Notification permission has been blocked. You'll need to enable it in your browser settings.</p>;
  }

  return (
    <div className="my-6 text-center">
      <button 
        onClick={requestPermission}
        className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold"
      >
        Enable Notifications
      </button>
    </div>
  );
}
