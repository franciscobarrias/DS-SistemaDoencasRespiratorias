const { ObservationDto } = require('../dtos/fhir/observation.dto');
const { mapObservation } = require('../mappers/fhir-observation.mapper');

const FHIR_BASE_URL = 'https://fhir.hl7.pt/r5/fhir';

// Resolver fetch: prefer global fetch (Node 18+), fallback para node-fetch
let _fetch: typeof fetch | undefined;
if (typeof globalThis.fetch === 'function') {
    // @ts-ignore
    _fetch = globalThis.fetch.bind(globalThis);
} else {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const nodeFetch = require('node-fetch');
        _fetch = nodeFetch;
    } catch (err) {
        throw new Error('No fetch available. Install Node 18+ or add node-fetch');
    }
}

async function getObservationsFromFhir(
    code: string = '8310-5',
    patient?: string
): Promise<any[]> {

    let url = `${FHIR_BASE_URL}/Observation?code=${encodeURIComponent(code)}`;

    if (patient) {
        url += `&subject=Patient/${patient}`;
    }

    const resposta = await _fetch!(url);

    if (!resposta.ok) {
        throw new Error(`Erro FHIR: ${resposta.status} - ${resposta.statusText}`);
    }

    const bundle = await resposta.json();
    const entries = bundle.entry || [];

    // Para cada observation, mapear e tentar buscar o nome do paciente associado
    const results = await Promise.all(entries.map(async (entry: any) => {
        const resource = entry.resource;
        const mapped = mapObservation(resource);

        // extrai id do subject (formato Patient/{id})
        const ref = resource.subject?.reference;
        if (ref && ref.startsWith('Patient/')) {
            const patientId = ref.split('/')[1];
            try {
                const patient = await getPatientFromFhir(patientId);
                // tenta extrair nome legível
                const name = Array.isArray(patient.name) && patient.name.length > 0 ? patient.name[0] : undefined;
                if (name) {
                    const given = Array.isArray(name.given) ? name.given.join(' ') : (name.given || '');
                    const family = name.family || '';
                    mapped.patientName = `${given} ${family}`.trim();
                } else {
                    mapped.patientName = patientId;
                }
            } catch (err) {
                mapped.patientName = ref;
            }
        } else {
            mapped.patientName = ref || '';
        }

        return mapped;
    }));

    return results;
}

async function getPatientFromFhir(patientId: string): Promise<any> {
    const url = `${FHIR_BASE_URL}/Patient/${patientId}`;
    const resposta = await _fetch!(url);

    if (!resposta.ok) {
        throw new Error(`Paciente FHIR não encontrado: ${resposta.status}`);
    }

    return resposta.json();
}

module.exports = { getObservationsFromFhir, getPatientFromFhir };

export {};
