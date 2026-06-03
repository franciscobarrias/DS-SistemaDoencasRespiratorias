const express = require('express');
const router = express.Router();
const clinicaController = require('../controllers/clinicaController');

// --- Rotas de Utentes ---
router.get('/utentes', clinicaController.getAllUtentes);
router.post('/utentes', clinicaController.addUtente); // 🛡️ NOVA: Criar novo utente
router.post('/utentes/sync/fhir', clinicaController.syncLegacyUtentesToFhir); // Sincronizar utentes sem fhir_id
router.post('/utentes/sync/fhir-all', clinicaController.syncAllFhirPatients); // 🔄 Sincronizar todos os patients do FHIR
router.post('/utentes/import-fhir/:fhirId', clinicaController.importUtenteFromFhir); // Importar Patient do FHIR
router.get('/utentes/:id/history', clinicaController.getHistoricoUtente); 

// ==========================================
// 🏥 ROTAS DE MÉDICOS
// ==========================================
router.get('/medicos', clinicaController.getAllMedicos);
router.post('/medicos', clinicaController.addMedico);
router.put('/medicos/:id', clinicaController.updateMedico);
router.delete('/medicos/:id', clinicaController.deleteMedico); 

// ==========================================
// 🛡️ NOVAS ROTAS: Gestão de Terapêutica
// ==========================================
router.get('/utentes/:id/terapeutica', clinicaController.getTerapeutica); // Listar medicamentos do utente
router.post('/utentes/:id/terapeutica', clinicaController.addMedicamento); // Gravar novo medicamento
router.post('/utentes/:id/temperatura', clinicaController.addTemperatura); // Registar temperatura manual
router.get('/utentes/:id/temperaturas', clinicaController.getTemperaturas); // Listar temperaturas manuais

// ==========================================
// 📊 NOVAS ROTAS: Observações FHIR (Medicamentos, Temperatura, etc.)
// ==========================================
router.get('/utentes/:id/observacoes-fhir', clinicaController.getObservacoesFhir); // Listar observações do patient
router.post('/utentes/:id/sincronizar-observacoes-fhir', clinicaController.syncObservacoesFhir); // Sincronizar observações do FHIR
router.post('/fhir/webhook/observacao', clinicaController.receberObservacaoFhir); // Webhook para receber observações do GraphBuilder/Postman

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
// Eliminar utente e dados relacionados
router.delete('/utentes/:id', clinicaController.deleteUtente);

module.exports = router;

export {};