const { randomUUID } = require('node:crypto');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const documentController = require('../controllers/documentController');

const router = express.Router();
const upload = multer({
  storage: multer.diskStorage({
    destination: path.resolve(__dirname, '../../storage'),
    filename(req, file, callback) {
      callback(null, randomUUID());
    },
  }),
});

router.post('/upload', upload.single('file'), documentController.uploadDocument);
router.get('/documents', documentController.listDocuments);
router.get('/documents/:id/download', documentController.downloadDocument);

module.exports = router;