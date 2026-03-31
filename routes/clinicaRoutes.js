const express = require('express');
const router = express.Router();
const clinicaController = require('../controllers/clinicaController');

// 🛡️ OS NOSSOS SEGURANÇAS
const { body, param } = require('express-validator'); // Validação de campos simples
const validateBody = require('../middleware/jsonValidator'); // Validação de objetos complexos (AJV)

// 📋 IMPORTAR OS CONTRATOS (JSON SCHEMAS)
const caratSchema = require('../schemas/carat-request.schema.json');
const alertPatchSchema = require('../schemas/alert-patch.schema.json');

// --- ROTAS DE LEITURA (GET) ---

router.get('/', clinicaController.mensagemRaiz);
router.get('/medicos', clinicaController.getMedicos);
router.get('/utentes', clinicaController.getUtentes);
router.get('/sintomas', clinicaController.getSintomas);
router.get('/avaliacoes', clinicaController.getAvaliacoes);

// --- GESTÃO DE SINTOMAS ---

/**
 * POST /sintomas
 * Validamos campos individuais antes de chegar ao controller.
 */
router.post('/sintomas', [
    body('utente_id').isInt().withMessage('O ID do utente tem de ser um número inteiro.'),
    body('descricao').notEmpty().trim().escape().withMessage('A descrição é obrigatória.'),
    body('severidade').isIn(['Leve', 'Moderada', 'Grave']).withMessage('Severidade inválida.')
], clinicaController.addSintoma);

/**
 * DELETE /sintomas/:id
 */
router.delete('/sintomas/:id', [
    param('id').isInt().withMessage('ID de sintoma inválido.')
], clinicaController.deleteSintoma);

// --- LÓGICA CLÍNICA E INTEROPERABILIDADE (JSON SCHEMA) ---

/**
 * POST /avaliacoes
 * Aqui o AJV usa o teu 'carat-request.schema.json' para garantir que:
 * 1. Existe um campo 'answers'.
 * 2. As respostas são números inteiros entre 0 e 4.
 */
router.post('/avaliacoes', validateBody(caratSchema), clinicaController.addAvaliacao);

/**
 * PATCH /alertas/:id
 * Usa o 'alert-patch.schema.json' para garantir que o médico só pode
 * alterar o estado ou a prioridade para valores permitidos.
 */
router.patch('/alertas/:id', [
    param('id').isInt().withMessage('ID de alerta inválido.'),
    validateBody(alertPatchSchema)
], (req, res) => {
    // Exemplo de implementação rápida ou rota para o controller
    res.json({ message: "Dados do alerta validados e prontos para atualizar!" });
});

module.exports = router;