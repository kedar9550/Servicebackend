const multer = require("multer");
const fs = require("fs");
 const { v4: uuidv4 } = require("uuid");

const storage = multer.diskStorage({

  destination: (req, file, cb) => {

    const uploadPath =
      `uploads/tickets/${req.ticketNumber}`;

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },

filename: (req, file, cb) => {
  const ext = file.originalname.split(".").pop();
  cb(null, uuidv4() + "." + ext);
}
    
});

module.exports = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }
});