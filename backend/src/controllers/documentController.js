const documentService = require('../services/documentService');

function uploadDocument(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'Envie um arquivo no campo file.' });
  }
  const document = documentService.createDocument(req.file, req.body?.owner);
  return res.status(201).json(document);
}

function listDocuments(req, res) {
  res.json(documentService.listDocuments());
}

function downloadDocument(req, res, next) {
  const document = documentService.getDocument(req.params.id);
  res.download(document.path, document.originalName, (error) => {
    if (error) next(error);
  });
}

module.exports = { uploadDocument, listDocuments, downloadDocument };