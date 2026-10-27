const express = require('express');
const multer = require('multer');
const documentRoutes = require('./routes/documentRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(documentRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: 'Upload inválido. Envie um único arquivo no campo file.' });
  }
  if (error.status === 404 || error.code === 'ENOENT') {
    return res.status(404).json({ error: 'Documento não encontrado.' });
  }
  if (error.status === 400) {
    return res.status(400).json({ error: 'Requisição inválida.' });
  }
  return res.status(500).json({ error: 'Não foi possível processar a solicitação.' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`DMS backend ouvindo na porta ${PORT}`);
  });
}

module.exports = app;
