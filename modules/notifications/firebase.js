const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");

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
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount)
    });
    console.log("Firebase Admin initialized successfully.");
  }
} else {
  console.error("Firebase Admin could not be initialized. Missing credentials.");
}

/**
 * Send a push notification to specific FCM tokens
 * @param {string[]} tokens - The FCM device tokens array
 * @param {string} title - The title of the notification
 * @param {string} body - The body/message of the notification
 * @param {object} data - Optional data payload
 * @returns {Promise<string[]>} Returns array of invalid tokens to be cleaned up
 */
const sendPushNotification = async (tokens, title, body, data = {}) => {
  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) return [];

  const invalidTokens = [];

  try {
    const message = {
      notification: {
        title,
        body
      },
      data,
      tokens,
      android: {
        priority: 'high'
      },
      webpush: {
        headers: {
          Urgency: 'high'
        },
        fcm_options: {
          link: '/'
        }
      }
    };

    const response = await getMessaging().sendEachForMulticast(message);
    console.log(`Successfully sent push notification. Success: ${response.successCount}, Failed: ${response.failureCount}`);
    
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(tokens[idx]);
          }
        }
      });
    }

    return invalidTokens;
  } catch (error) {
    console.error("Error sending push notification:", error);
    return [];
  }
};

module.exports = {
  sendPushNotification
};
