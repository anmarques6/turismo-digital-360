// Função da Vercel: recebe todos os pedidos /api/* (ver vercel.json)
const { tratarAPI } = require('../src/app');
module.exports = (req, res) => tratarAPI(req, res);
