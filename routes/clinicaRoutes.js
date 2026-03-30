const express = require('express');
const router = express.Router();
const clinicaController = require('../controllers/clinicaController');

router.get('/', clinicaController.mensagemRaiz);
router.get('/medicos', clinicaController.getMedicos);
router.get('/sintomas', clinicaController.getSintomas);
router.post('/sintomas', clinicaController.addSintoma);
router.delete('/sintomas/:id', clinicaController.deleteSintoma);
router.get('/utentes', clinicaController.getUtentes);
router.get('/avaliacoes', clinicaController.getAvaliacoes);
router.post('/avaliacoes', clinicaController.addAvaliacao);

module.exports = router;