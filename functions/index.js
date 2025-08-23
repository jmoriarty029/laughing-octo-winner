// This file should only contain the code below.
// Delete all other functions or boilerplate code from your local index.js file.

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.sendEmailOnGrievanceUpdate = functions.firestore
  .document("grievances/{grievanceId}")
  .onWrite(async (change, context) => {
    const newData = change.after.data();
    const beforeData = change.before.data();

    // --- IMPORTANT: CONFIGURE YOUR EMAILS HERE ---
    const userEmail = "ayeshaayub2601@gmail.com";
    const adminEmail = "larasib345@gmail.com";

    let subject = "";
    let htmlBody = "";
    let recipients = [];

    // Case 1: A new grievance was created by the user
    if (!change.before.exists) {
      subject = `New Grievance Filed: ${newData.title}`;
      htmlBody = `
        <h1>New Grievance Submitted</h1>
        <p>A new grievance has been filed by a user.</p>
        <ul>
          <li><strong>Title:</strong> ${newData.title}</li>
          <li><strong>Severity:</strong> ${newData.severity}</li>
          <li><strong>Category:</strong> ${newData.category}</li>
          ${newData.details ? `<li><strong>Details:</strong> ${newData.details}</li>` : ""}
        </ul>
        <p>You can view and manage this grievance in the admin portal.</p>
      `;
      recipients = [adminEmail];
    } 
    // Case 2: An existing grievance's status was changed by the admin
    else if (newData.status !== beforeData.status) {
      subject = `Status Update for your Grievance: ${newData.title}`;
      htmlBody = `
        <h1>Grievance Status Updated</h1>
        <p>The status of your grievance titled "<strong>${newData.title}</strong>" has been updated.</p>
        <p>The new status is: <strong>${newData.status}</strong></p>
      `;
      recipients = [userEmail];
    } 
    // If nothing important changed, stop here.
    else {
      console.log("No new grievance or status change detected. No email will be sent.");
      return null;
    }

    // Create the email document in the 'mail' collection.
    // This triggers the "Trigger Email" extension to send the email.
    await admin.firestore().collection("mail").add({
      to: recipients,
      message: {
        subject: subject,
        html: htmlBody,
      },
    });

    console.log(`Email document created for recipients: ${recipients.join(", ")}`);
    return null;
  });
