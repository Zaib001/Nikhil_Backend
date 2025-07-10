const express = require("express");
const multer = require("multer");
const router = express.Router();
const { uploadDocument, getDocuments, deleteDocument } = require("../controllers/document.controller");
const { protect } = require("../middleware/authMiddleware");

const upload = multer({ dest: "uploads/" }); 

router.post("/", protect, upload.single("file"), uploadDocument);
router.get("/", protect, getDocuments);
router.delete("/:id", protect, deleteDocument);

module.exports = router;
