const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// --- FUNCTION 1: Email the USER when an admin posts an update ---
exports.emailUserOnUpdate = functions.firestore
  .document("grievances/{grievanceId}")
  .onUpdate(async (change) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();

    const beforeUpdates = beforeData.updates || [];
    const afterUpdates = afterData.updates || [];

    // Trigger only when a new update is added
    if (afterUpdates.length > beforeUpdates.length) {
      const newUpdate = afterUpdates[afterUpdates.length - 1];
      const userId = afterData.uid;

      if (!userId) return null;

      // Get the user's email address from Firebase Authentication
      const user = await admin.auth().getUser(userId);
      const userEmail = user.email;

      if (!userEmail) {
        console.log("User has no email address:", userId);
        return null;
      }

      // Create an email document in the 'mail' collection
      const mailRef = admin.firestore().collection("mail");
      await mailRef.add({
        to: userEmail,
        // --- NEW: Specify the 'from' address ---
        from: "YOUR_GMAIL_ADDRESS", // Replace with your actual Gmail address
        message: {
          subject: `An update on your grievance: "${afterData.title}"`,
          html: `
            <p>Hello,</p>
            <p>A new update has been posted for your grievance titled "<strong>${afterData.title}</strong>".</p>
            <p><strong>Update:</strong> "${newUpdate.text}"</p>
            <p>You can view the full details by logging into the portal.</p>
          `,
        },
      });
    }
    return null;
  });

// --- FUNCTION 2: Email the ADMIN when a user files a new grievance ---
exports.emailAdminOnCreate = functions.firestore
  .document("grievances/{grievanceId}")
  .onCreate(async (snap) => {
    const newGrievance = snap.data();

    // --- IMPORTANT: Replace this with your actual Admin User ID ---
    const adminUid = "YOUR_ADMIN_UID_HERE";

    // Get the admin's email address
    const adminUser = await admin.auth().getUser(adminUid);
    const adminEmail = adminUser.email;

    if (!adminEmail) {
      console.log("Admin user has no email address:", adminUid);
      return null;
    }

    // Create an email document in the 'mail' collection
    const mailRef = admin.firestore().collection("mail");
    await mailRef.add({
      to: adminEmail,
      // --- NEW: Specify the 'from' address ---
      from: "YOUR_GMAIL_ADDRESS", // Replace with your actual Gmail address
      message: {
        subject: "A new grievance has been filed!",
        html: `
          <p>A new grievance has been submitted.</p>
          <p><strong>Title:</strong> ${newGrievance.title}</p>
          <p><strong>Category:</strong> ${newGrievance.category}</p>
          <p><strong>Severity:</strong> ${newGrievance.severity}</p>
          <p>Please log in to the admin dashboard to review it.</p>
        `,
      },
    });
    return null;
  });
