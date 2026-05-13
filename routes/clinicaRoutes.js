const express = require('express');
const router = express.Router();
const clinicaController = require('../controllers/clinicaController');

// --- Rotas de Utentes ---
router.get('/utentes', clinicaController.getAllUtentes);
router.get('/utentes/:id/historico', clinicaController.getHistoricoUtente);

// --- Rotas de Avaliações CARAT ---
router.get('/carat-resultados', clinicaController.getAvaliacoes);
router.post('/utentes/:id/carat', clinicaController.addAvaliacao);

// --- Rotas de Gestão Clínica (Médico) ---
router.get('/medico/alertas', clinicaController.getAlertas);
router.put('/medico/alertas/:id/resolver', clinicaController.resolverAlerta);

// --- Rotas de Sintomas ---
router.get('/sintomas/:utente_id', clinicaController.getSintomas);

// 👇 A LINHA QUE ESTAVA A CAUSAR O ERRO 404 É ESTA 👇
router.post('/sintomas', clinicaController.addSintoma);

module.exports = router;