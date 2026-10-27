const documentRepository = require('../repositories/documentRepository');

function toMetadata(document) {
  return {
    id: document.id,
    originalName: document.originalName,
    size: document.size,
    createdAt: document.createdAt,
    owner: document.owner,
  };
}

function createDocument(file, owner) {
  const document = documentRepository.save({
    id: file.filename,
    originalName: file.originalname,
    size: file.size,
    createdAt: new Date().toISOString(),
    owner: typeof owner === 'string' ? owner.trim() || null : null,
    path: file.path,
  });
  return toMetadata(document);
}

function listDocuments() {
  return documentRepository.findAll().map(toMetadata);
}

function getDocument(id) {
  const document = documentRepository.findById(id);
  if (!document) {
    const error = new Error('Documento não encontrado.');
    error.status = 404;
    throw error;
  }
  return document;
}

module.exports = { createDocument, listDocuments, getDocument };