const multer = require('multer')
const path = require('path')

const storage = multer.diskStorage({
    destination:'./uploads/profile',
    filename: function(req,file,cb){
        cb(null,req.user._id + path.extname(file.originalname))
    }
})

const profileupload = multer(
    {storage,
        limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: function (req, file, cb) {
        const allowed = /jpeg|jpg|png/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);

        if (ext && mime) {
            cb(null, true);
        } else {
            cb("Only Images Allowed");
        }
    }
    }
)

module.exports = profileupload