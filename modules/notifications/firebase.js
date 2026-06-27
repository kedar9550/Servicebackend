const admin = require("firebase-admin");

let serviceAccount;

// Check if credentials are provided via Environment Variable (For Render/Production)
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (err) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT from environment variables.");
  }
} else {
  // Fallback to local file for development
  try {
    serviceAccount = require("../../config/serviceAccountKey.json");
  } catch (err) {
    console.error("serviceAccountKey.json not found locally.");
  }
}

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} else {
  console.error("Firebase Admin could not be initialized. Missing credentials.");
}

/**
 * Send a push notification to a specific FCM token
 * @param {string} token - The FCM device token
 * @param {string} title - The title of the notification
 * @param {string} body - The body/message of the notification
 * @param {object} data - Optional data payload
 */
const sendPushNotification = async (token, title, body, data = {}) => {
  if (!token) return;

  try {
    const message = {
      notification: {
        title,
        body
      },
      data,
      token,
      android: {
        priority: 'high'
      },
      webpush: {
        headers: {
          Urgency: 'high'
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log("Successfully sent push notification:", response);
    return response;
  } catch (error) {
    console.error("Error sending push notification:", error);
    // If token is unregistered, we might want to handle it (e.g. remove from DB)
    if (error.code === 'messaging/registration-token-not-registered') {
      console.log('Token is no longer valid:', token);
    }
  }
};

module.exports = {
  admin,
  sendPushNotification
};
