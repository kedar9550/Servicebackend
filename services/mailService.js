const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // REQUIRED for 465
    auth: {
        user: process.env.EMAIL_USER, // full gmail
        pass: process.env.EMAIL_PASS, // Gmail App Password ONLY
    },
    tls: {
        rejectUnauthorized: false, // avoids TLS issues on Render
    },
});

// VERIFY SMTP ON STARTUP
transporter.verify((error, success) => {
    if (error) {
        console.error(" SMTP VERIFY FAILED:", error);
    } else {
        // console.log(" SMTP SERVER READY");
    }
});

// SEND OTP MAIL

const sendOtpMail = async (email, otp) => {
    try {
        // console.log("📧 Sending OTP mail to:", email);

        const info = await transporter.sendMail({
            from: `"Aditya University" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Password Reset OTP",
            html: `
        <h2>Password Reset Request</h2>
        <p>Your OTP is:</p>
        <h1 style="color:blue;">${otp}</h1>
        <p>This OTP is valid for 10 minutes.</p>
      `,
        });

        // console.log("✅ OTP MAIL SENT:", info.messageId);
    } catch (error) {
        console.error("❌ OTP MAIL FAILED:", error);
        throw error;
    }
};


const sendComplaintMail = async (complaint, files = []) => {
  await transporter.sendMail({
    from: `"Laptop Repair System" <${process.env.EMAIL_USER}>`,
    to: "kedarnath.mech@gmail.com",
    subject: `New Complaint ${complaint.complaintId}`,
    html: `
      <h2>New Laptop Repair Request</h2>
      <p><b>ID:</b> ${complaint.complaintId}</p>
      <p><b>Name:</b> ${complaint.name}</p>
      <p><b>Mobile:</b> ${complaint.phone}</p>
      <p><b>Issue:</b> ${complaint.issueType === "Other" ? complaint.customIssue : complaint.issueType}</p>
      <p><b>Description:</b> ${complaint.description}</p>
    `,
    attachments: files.length
      ? files.map(f => ({
          filename: f.originalname,
          path: f.path,
        }))
      : [],
  });
};


module.exports = { sendOtpMail, sendComplaintMail };


