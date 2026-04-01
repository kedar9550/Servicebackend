const jwt = require("jsonwebtoken");

const isProd = process.env.NODE_ENV?.toLowerCase() === "production";

const generateTokenAndSetCookie = (payload, res) => {

  const token = jwt.sign(payload,
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.cookie("token", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  return token;
};

module.exports = generateTokenAndSetCookie;
