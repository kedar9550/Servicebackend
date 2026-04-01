const axios = require("axios");

const sendOtpSms = async (mobile_number, name, otp) => {
  try {
    // The provided API URL uses GET and carries parameters in the query string
    const smsApiUrl = `https://pgapi.vispl.in/fe/api/v1/multiSend?username=aditrpg1.trans&password=Ad1tya@1234&unicode=false&from=ADIUNV&to=${mobile_number}&text=Dear+${name},+Thank+you+for+reaching+out+to+us.+To+verify+your+request+and+proceed+with+further+actions,+please+use+the+following+One-Time+Password+(OTP):${otp}+@ADITYA+UNIVERSITY`;

    // console.log("📱 Sending OTP SMS to:", mobile_number);

    const response = await axios.get(smsApiUrl);

    // console.log("✅ SMS API response:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ OTP SMS FAILED:", error.message);
    throw error;
  }
};

module.exports = { sendOtpSms };
