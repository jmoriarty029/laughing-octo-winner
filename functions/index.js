// Use the required v2 syntax for Cloud Functions
const { onDocumentUpdated, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Initialize the Firebase Admin SDK
initializeApp();

// --- FUNCTION 1: Email the USER when an admin posts an update ---
// This function uses the modern onDocumentUpdated trigger
exports.emailUserOnUpdate = onDocumentUpdated("grievances/{grievanceId}", async (event) => {
    // Get the data before and after the change
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();

    const beforeUpdates = beforeData.updates || [];
    const afterUpdates = afterData.updates || [];

    // Trigger only when a new update is added
    if (afterUpdates.length > beforeUpdates.length) {
        const newUpdate = afterUpdates[afterUpdates.length - 1];
        const userEmail = "ayeshaayub2601@gmail.com";

        try {
            // Get a reference to the 'mail' collection and add a new document
            const mailRef = getFirestore().collection("mail");
            await mailRef.add({
                to: userEmail,
                from: "larasib345@gmail.com",
                message: {
                    subject: `An update on your grievance: "${afterData.title}"`,
                    html: `
                        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                            <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                                <h2 style="color: #ec4899; text-align: center;">Grievance Update</h2>
                                <p>Hello,</p>
                                <p>A new update has been posted for your grievance titled "<strong>${afterData.title}</strong>".</p>
                                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; border-left: 4px solid #ec4899;">
                                    <p style="margin: 0;"><strong>Admin's Note:</strong></p>
                                    <p style="margin: 0; font-style: italic;">"${newUpdate.text}"</p>
                                </div>
                                <p>You can view the full details by logging into the portal.</p>
                                <p style="text-align: center; margin-top: 30px;">
                                    <a href="YOUR_APP_URL_HERE" style="background-color: #ec4899; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">View Grievance</a>
                                </p>
                            </div>
                            <p style="text-align: center; font-size: 12px; color: #aaa;">This is an automated message from the Grievance Portal.</p>
                        </div>
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
// This function uses the modern onDocumentCreated trigger
exports.emailAdminOnCreate = onDocumentCreated("grievances/{grievanceId}", async (event) => {
    const newGrievance = event.data.data();
    const adminEmail = "larasib345@gmail.com";

    try {
        // Get a reference to the 'mail' collection and add a new document
        const mailRef = getFirestore().collection("mail");
        await mailRef.add({
            to: adminEmail,
            from: "larasib345@gmail.com",
            message: {
                subject: "A new grievance has been filed!",
                html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                            <h2 style="color: #475569; text-align: center;">New Grievance Filed</h2>
                            <p>A new grievance has been submitted with the following details:</p>
                            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px;">
                                <p style="margin: 5px 0;"><strong>Title:</strong> ${newGrievance.title}</p>
                                <p style="margin: 5px 0;"><strong>Category:</strong> ${newGrievance.category}</p>
                                <p style="margin: 5px 0;"><strong>Severity:</strong> ${newGrievance.severity}</p>
                            </div>
                            <p>Please log in to the admin dashboard to review and manage this grievance.</p>
                            <p style="text-align: center; margin-top: 30px;">
                                <a href="YOUR_APP_URL_HERE/admin" style="background-color: #475569; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">Go to Admin Dashboard</a>
                            </p>
                        </div>
                        <p style="text-align: center; font-size: 12px; color: #aaa;">This is an automated message from the Grievance Portal.</p>
                    </div>
                `,
            },
        });
        console.log("Successfully created new grievance email for admin:", adminEmail);
    } catch (error) {
        console.error("Failed to create new grievance email for admin:", error);
    }
    return null;
});

