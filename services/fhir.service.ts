const { ObservationDto } = require('../dtos/fhir/observation.dto');
const { mapObservation } = require('../mappers/fhir-observation.mapper');

const FHIR_BASE_URL = 'https://fhir.hl7.pt/r5/fhir';

async function getObservationsFromFhir(
    code: string = '8310-5',
    patient?: string
): Promise<any[]> {

    let url = `${FHIR_BASE_URL}/Observation?code=${encodeURIComponent(code)}`;

    if (patient) {
        url += `&subject=Patient/${patient}`;
    }

    const resposta = await fetch(url);

    if (!resposta.ok) {
        throw new Error(`Erro FHIR: ${resposta.status} - ${resposta.statusText}`);
    }

    const bundle = await resposta.json();
    return bundle.entry?.map((entry: any) => mapObservation(entry.resource)) || [];
}

async function getPatientFromFhir(patientId: string): Promise<any> {
    const url = `${FHIR_BASE_URL}/Patient/${patientId}`;
    const resposta = await fetch(url);

    if (!resposta.ok) {
        throw new Error(`Paciente FHIR não encontrado: ${resposta.status}`);
    }

    return resposta.json();
}

module.exports = { getObservationsFromFhir, getPatientFromFhir };

export {};
