const express = require('express');
const routes = express.Router();
const { getObservationsFromFhir, getPatientFromFhir } = require('../services/fhir.service');
const { autenticar } = require('../middleware/auth.middleware');

routes.get('/observations', autenticar, async (req: any, res: any) => {
    try {
        const code = typeof req.query['code'] === 'string' ? req.query['code'] : '8310-5';
        const patient = typeof req.query['patient'] === 'string' ? req.query['patient'] : undefined;

        const observations = await getObservationsFromFhir(code, patient);
        res.json(observations);
    } catch (error: any) {
        res.status(500).json({ erro: 'Erro ao consultar servidor FHIR.', detalhe: error.message });
    }
});

routes.get('/patients/:id', autenticar, async (req: any, res: any) => {
    try {
        const patient = await getPatientFromFhir(req.params['id'] as string);
        res.json(patient);
    } catch (error: any) {
        res.status(404).json({ erro: error.message });
    }
});

module.exports = routes;

export {};
