const admin = require("firebase-admin");
const serviceAccount = require("../../config/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

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
      token
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
