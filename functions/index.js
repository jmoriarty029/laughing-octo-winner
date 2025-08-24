const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// This function triggers whenever a document in the 'grievances' collection is updated.
exports.sendGrievanceUpdateNotification = functions.firestore
  .document("grievances/{grievanceId}")
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();

    // Check if a new update was added by comparing the 'updates' array length
    const beforeUpdates = beforeData.updates || [];
    const afterUpdates = afterData.updates || [];

    if (afterUpdates.length > beforeUpdates.length) {
      const newUpdate = afterUpdates[afterUpdates.length - 1];
      const userId = afterData.uid;

      if (!userId) {
        console.log("No user ID found for this grievance.");
        return null;
      }

      // Get all the FCM tokens for this user
      const db = admin.firestore();
      const tokensSnapshot = await db.collection("fcmTokens")
          .where("uid", "==", userId).get();

      if (tokensSnapshot.empty) {
        console.log("No FCM tokens found for user:", userId);
        return null;
      }

      const tokens = tokensSnapshot.docs.map((doc) => doc.id);

      // Notification payload
      const payload = {
        notification: {
          title: `Update on: ${afterData.title}`,
          body: newUpdate.text,
          click_action: "/", // URL to open when notification is clicked
          icon: "/icons/icon-192.png",
        },
      };

      // Send a notification to each of the user's devices
      const response = await admin.messaging().sendToDevice(tokens, payload);
      console.log("Notification sent successfully:", response);

      // Optional: Clean up invalid tokens
      response.results.forEach((result, index) => {
        const error = result.error;
        if (error) {
          console.error("Failure sending notification to", tokens[index], error);
          if (error.code === "messaging/registration-token-not-registered") {
            // This token is invalid, remove it from the database
            tokensSnapshot.docs[index].ref.delete();
          }
        }
      });
    }
    return null;
  });
