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
    code?: string,
    patient?: string
): Promise<any[]> {

    const params: string[] = ['_count=200'];
    if (code) params.push(`code=${encodeURIComponent(code)}`);
    if (patient) params.push(`subject=${encodeURIComponent(`Patient/${patient}`)}`);

    let url = `${FHIR_BASE_URL}/Observation${params.length ? `?${params.join('&')}` : ''}`;
    const allEntries: any[] = [];

    // Seguir paginação do Bundle para obter visão global completa
    while (url) {
        const resposta = await _fetch!(url);
        if (!resposta.ok) {
            throw new Error(`Erro FHIR: ${resposta.status} - ${resposta.statusText}`);
        }

        const bundle = await resposta.json();
        const entries = Array.isArray(bundle.entry) ? bundle.entry : [];
        allEntries.push(...entries);

        const nextLink = Array.isArray(bundle.link)
            ? bundle.link.find((l: any) => l.relation === 'next')
            : undefined;
        url = nextLink?.url || '';
    }

    const patientNameCache = new Map<string, string>();

    // Para cada observation, mapear e tentar buscar o nome do paciente associado
    const results = await Promise.all(allEntries.map(async (entry: any) => {
        const resource = entry.resource;
        const mapped = mapObservation(resource);

        // extrai id do subject (formato Patient/{id})
        const ref = resource.subject?.reference;
        if (ref && ref.startsWith('Patient/')) {
            const patientId = ref.split('/')[1];
            try {
                if (!patientNameCache.has(patientId)) {
                    const patientObj = await getPatientFromFhir(patientId);
                    const name = Array.isArray(patientObj.name) && patientObj.name.length > 0 ? patientObj.name[0] : undefined;
                    if (name) {
                        const given = Array.isArray(name.given) ? name.given.join(' ') : (name.given || '');
                        const family = name.family || '';
                        patientNameCache.set(patientId, `${given} ${family}`.trim() || patientId);
                    } else {
                        patientNameCache.set(patientId, patientId);
                    }
                }
                mapped.patientName = patientNameCache.get(patientId) || patientId;
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
