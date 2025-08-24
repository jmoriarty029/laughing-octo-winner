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
      
      const userEmail = "ayeshaayub2601@gmail.com";

      try {
        const mailRef = admin.firestore().collection("mail");
        await mailRef.add({
          to: userEmail,
          from: "larasib345@gmail.com", // Explicitly set the 'from' address
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
        console.log("Successfully created update email for:", userEmail);
      } catch (error) {
        console.error("Failed to create update email:", error);
      }
    }
    return null;
  });

// --- FUNCTION 2: Email ADMIN when a user files a new grievance ---
exports.emailAdminOnCreate = functions.firestore
  .document("grievances/{grievanceId}")
  .onCreate(async (snap) => {
    const newGrievance = snap.data();
    
    const adminEmail = "larasib345@gmail.com";

    try {
      // Create an email document in the 'mail' collection for the admin
      const mailRef = admin.firestore().collection("mail");
      await mailRef.add({
        to: adminEmail,
        from: "larasib345@gmail.com", // Explicitly set the 'from' address
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
      console.log("Successfully created new grievance email for admin:", adminEmail);
    } catch (error) {
      console.error("Failed to create new grievance email for admin:", error);
    }
    return null;
  });
