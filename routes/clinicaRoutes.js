const express = require('express');
const router = express.Router();
const clinicaController = require('../controllers/clinicaController');

// Importar o nosso Middleware de Validação e os Contratos (Schemas)
const validateBody = require('../middleware/jsonValidator');
const caratSchema = require('../schemas/carat-request.schema.json');
const alertSchema = require('../schemas/alert-patch.schema.json');

// ---------------------------------------------------
// 🛣️ ROTAS DA API
// ---------------------------------------------------

// Rotas de Utentes
router.get('/utentes', clinicaController.getUtentes);

// Rotas de Avaliações (O POST usa o validador do CARAT!)
router.get('/avaliacoes', clinicaController.getAvaliacoes);
router.post('/avaliacoes', validateBody(caratSchema), clinicaController.addAvaliacao);

// Rotas de Sintomas
router.get('/sintomas', clinicaController.getSintomas);
router.post('/sintomas', clinicaController.addSintoma);
router.delete('/sintomas/:id', clinicaController.deleteSintoma);

// Rota de Alertas (A Rota do botão "Resolver" - Usa o validador de Alertas!)
router.patch('/alertas/:id', validateBody(alertSchema), clinicaController.atualizarAlerta);

module.exports = router;