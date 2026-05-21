const express = require('express');
const router = express.Router();
const clinicaController = require('../controllers/clinicaController');

// --- Rotas de Utentes ---
router.get('/utentes', clinicaController.getAllUtentes);
router.post('/utentes', clinicaController.addUtente); // 🛡️ NOVA: Criar novo utente
router.post('/utentes/sync/fhir', clinicaController.syncLegacyUtentesToFhir); // Sincronizar utentes sem fhir_id
router.get('/utentes/:id/history', clinicaController.getHistoricoUtente); 

// ==========================================
// 🛡️ NOVAS ROTAS: Gestão de Terapêutica
// ==========================================
router.get('/utentes/:id/terapeutica', clinicaController.getTerapeutica); // Listar medicamentos do utente
router.post('/utentes/:id/terapeutica', clinicaController.addMedicamento); // Gravar novo medicamento

// --- Rotas de Avaliações CARAT ---
router.get('/carat-resultados', clinicaController.getAvaliacoes);
router.post('/utentes/:id/carat', clinicaController.addAvaliacao);

// --- Rotas de Gestão Clínica (Médico) ---
router.get('/medico/alertas', clinicaController.getAlertas);
router.put('/medico/alertas/:id/resolver', clinicaController.resolverAlerta);

// --- Rotas de Sintomas ---
router.get('/sintomas', clinicaController.getAllSintomas); // Listar todos os sintomas globais
router.get('/sintomas/:utente_id', clinicaController.getSintomas); // Listar sintomas de um utente
router.post('/sintomas', clinicaController.addSintoma); // Gravar novo sintoma
router.delete('/sintomas/:id', clinicaController.deleteSintoma); // Eliminar sintoma pelo caixote do lixo

module.exports = router;

export {};