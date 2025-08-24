const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// --- FUNCTION 1: Notify USER when an admin posts an update ---
exports.sendGrievanceUpdateNotification = functions.firestore
  .document("grievances/{grievanceId}")
  .onUpdate(async (change) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();

    const beforeUpdates = beforeData.updates || [];
    const afterUpdates = afterData.updates || [];

    if (afterUpdates.length > beforeUpdates.length) {
      const newUpdate = afterUpdates[afterUpdates.length - 1];
      const userId = afterData.uid;

      if (!userId) return null;

      const db = admin.firestore();
      const tokensSnapshot = await db.collection("fcmTokens")
          .where("uid", "==", userId).get();

      if (tokensSnapshot.empty) return null;

      const tokens = tokensSnapshot.docs.map((doc) => doc.id);
      const payload = {
        notification: {
          title: `Update on: ${afterData.title}`,
          body: newUpdate.text,
          click_action: "/",
          icon: "/icons/icon-192.png",
        },
      };

      return admin.messaging().sendToDevice(tokens, payload);
    }
    return null;
  });


// --- FUNCTION 2: Notify ADMIN when a user files a new grievance ---
exports.sendNewGrievanceNotification = functions.firestore
  .document("grievances/{grievanceId}")
  .onCreate(async (snap) => {
    const newGrievance = snap.data();

    // --- IMPORTANT: Replace this with your actual Admin User ID ---
    const adminUid = "OujCHPP7wSUJOa5iQLNMbu06tAb2"; 
    // In a real app, you might get this from a config file or another Firestore document.

    const db = admin.firestore();
    const tokensSnapshot = await db.collection("fcmTokens")
        .where("uid", "==", adminUid).get();

    if (tokensSnapshot.empty) {
      console.log("No FCM tokens found for admin:", adminUid);
      return null;
    }

    const tokens = tokensSnapshot.docs.map((doc) => doc.id);
    const payload = {
      notification: {
        title: "New Grievance Filed!",
        body: newGrievance.title,
        click_action: "/admin", // Link to the admin panel
        icon: "/icons/icon-192.png",
      },
    };
    
    return admin.messaging().sendToDevice(tokens, payload);
  });
