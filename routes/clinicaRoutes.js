const express = require('express');
const router = express.Router();
const clinicaController = require('../controllers/clinicaController');
const { body, param } = require('express-validator'); // 🛡️ O nosso segurança

router.get('/', clinicaController.mensagemRaiz);
router.get('/medicos', clinicaController.getMedicos);
router.get('/sintomas', clinicaController.getSintomas);

// Rota POST Sintomas (Protegida)
router.post('/sintomas', [
    body('utente_id').isInt().withMessage('O ID do utente tem de ser um número inteiro.'),
    body('descricao').notEmpty().trim().escape().withMessage('A descrição do sintoma é obrigatória.'),
    body('severidade').isIn(['Leve', 'Moderada', 'Grave']).withMessage('Severidade inválida.')
], clinicaController.addSintoma);

router.delete('/sintomas/:id', clinicaController.deleteSintoma);
router.get('/utentes', clinicaController.getUtentes);
router.get('/avaliacoes', clinicaController.getAvaliacoes);

// 🛡️ NOVA ROTA POST Avaliações CARAT (Protegida)
router.post('/avaliacoes', [
    body('utente_id').isInt().withMessage('O ID do utente tem de ser um número inteiro.'),
    body('respostas').isArray().withMessage('As respostas têm de ser enviadas numa lista (array).')
], clinicaController.addAvaliacao);


// Endpoint Sprint 2: POST /patients/:id/carat
router.post('/patients/:id/carat', [
    param('id').isInt().withMessage('O ID do paciente deve ser um número inteiro.'),
    body('answers').isObject().withMessage('O campo answers é obrigatório e deve ser um objeto.')
], clinicaController.addCaratEvaluation);

module.exports = router;