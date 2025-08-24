import { useState, useEffect } from 'react';
import { getMessaging, getToken } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export default function NotificationButton({ user }) {
  const [permission, setPermission] = useState(Notification.permission);

  async function requestPermission() {
    if (!('Notification' in window)) return;

    const newPermission = await Notification.requestPermission();
    setPermission(newPermission);

    if (newPermission === 'granted') {
      await saveMessagingDeviceToken();
    }
  }

  async function saveMessagingDeviceToken() {
    try {
      const messaging = getMessaging();
      // IMPORTANT: Replace this with your VAPID key from the Firebase Console
      const fcmToken = await getToken(messaging, { vapidKey: 'BIHmz65tUVlXiBrt-UCof6oMjdLZRmlveSRDa5IGC1_y1P8QYZAJMTAaV3RVJZmXaS5WcX4Qrvk' });

      if (fcmToken) {
        const tokenRef = doc(db, `fcmTokens/${fcmToken}`);
        await setDoc(tokenRef, { 
          uid: user.uid,
          createdAt: serverTimestamp() 
        });
      } else {
        requestPermission();
      }
    } catch (error) {
      console.error('Unable to get messaging token.', error);
    }
  }

  useEffect(() => {
    if (user && permission === 'granted') {
      saveMessagingDeviceToken();
    }
  }, [user, permission]);

  if (!user || permission === 'granted') {
    return null;
  }

  if (permission === 'denied') {
    return <p className="text-xs text-center text-red-500 my-4">Notification permission blocked. Please enable it in browser settings.</p>;
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
