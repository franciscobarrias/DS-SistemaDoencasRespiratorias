const express = require('express');
const router = express.Router();
const clinicaController = require('../controllers/clinicaController');

// --- Rotas de Utentes ---
router.get('/utentes', clinicaController.getAllUtentes);
router.get('/utentes/:id/historico', clinicaController.getHistoricoUtente);
router.post('/utentes/:id/carat', clinicaController.addAvaliacao);

// --- Rotas de Gestão Clínica (Médico) ---
router.get('/medico/alertas', clinicaController.getAlertas);
router.put('/medico/alertas/:id/resolver', clinicaController.resolverAlerta);

// --- Rotas de Sintomas ---
router.get('/sintomas/:utente_id', clinicaController.getSintomas);

module.exports = router;