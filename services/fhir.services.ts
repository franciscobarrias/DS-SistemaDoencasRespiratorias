// Serviço FHIR para pacientes (Patient)
// Fornece: mapUtenteToFhir, createPatient, getPatient, searchPatients, updatePatient, deletePatient

const FHIR_BASE = process.env.FHIR_SERVER || 'https://fhir.hl7.pt/r5/fhir';
const FHIR_TOKEN = process.env.FHIR_TOKEN || '';

// Resolve fetch: prefer global fetch (Node 18+), fallback to node-fetch if installed
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

export type Utente = {
    id?: number | string;
    nome?: string; // nome completo
    email?: string;
    telefone?: string;
    data_nascimento?: string; // YYYY-MM-DD
    genero?: 'male' | 'female' | 'other' | 'unknown' | string;
};

function mapUtenteToFhir(u: Utente) {
    const names = (u.nome || '').trim().split(/\s+/).filter(Boolean);
    const family = names.length > 0 ? names[names.length - 1] : undefined;
    const given = names.length > 1 ? names.slice(0, -1) : names.length === 1 ? [names[0]] : [];

    const patient: any = {
        resourceType: 'Patient',
    };

    if (u.id !== undefined) {
        patient.identifier = [{ system: 'urn:local:utente-id', value: String(u.id) }];
    }

    if (family || given.length) {
        patient.name = [Object.assign({}, family ? { family } : {}, given.length ? { given } : {})];
    }

    const telecom: Array<{ system: string; value: string }> = [];
    if (u.email) telecom.push({ system: 'email', value: u.email });
    if (u.telefone) telecom.push({ system: 'phone', value: u.telefone });
    if (telecom.length) patient.telecom = telecom;

    if (u.data_nascimento) patient.birthDate = u.data_nascimento;
    if (u.genero) patient.gender = u.genero;

    return patient;
}

function defaultHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: 'application/fhir+json',
        'Content-Type': 'application/fhir+json',
    };
    if (FHIR_TOKEN) headers.Authorization = `Bearer ${FHIR_TOKEN}`;
    return headers;
}

async function createPatient(utente: Utente): Promise<any> {
    const patient = mapUtenteToFhir(utente);
    const res = await _fetch!(`${FHIR_BASE}/Patient`, {
        method: 'POST',
        headers: defaultHeaders(),
        body: JSON.stringify(patient),
    } as any);
    if (!res.ok) throw new Error(`FHIR create failed: ${res.status} ${res.statusText}`);
    return res.json();
}

async function getPatient(id: string): Promise<any> {
    const res = await _fetch!(`${FHIR_BASE}/Patient/${encodeURIComponent(id)}`, {
        method: 'GET',
        headers: defaultHeaders(),
    } as any);
    if (!res.ok) throw new Error(`FHIR get failed: ${res.status} ${res.statusText}`);
    return res.json();
}

async function searchPatients(params: Record<string, string | number>): Promise<any> {
    const qs = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
    const url = `${FHIR_BASE}/Patient${qs ? '?' + qs : ''}`;
    const res = await _fetch!(url, { method: 'GET', headers: defaultHeaders() } as any);
    if (!res.ok) throw new Error(`FHIR search failed: ${res.status} ${res.statusText}`);
    return res.json();
}

async function updatePatient(id: string, patch: any): Promise<any> {
    const res = await _fetch!(`${FHIR_BASE}/Patient/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: defaultHeaders(),
        body: JSON.stringify(patch),
    } as any);
    if (!res.ok) throw new Error(`FHIR update failed: ${res.status} ${res.statusText}`);
    return res.json();
}

async function deletePatient(id: string): Promise<{ status: number }> {
    const res = await _fetch!(`${FHIR_BASE}/Patient/${encodeURIComponent(id)}`, { method: 'DELETE', headers: defaultHeaders() } as any);
    if (!res.ok && res.status !== 204) throw new Error(`FHIR delete failed: ${res.status} ${res.statusText}`);
    return { status: res.status };
}

export { mapUtenteToFhir, createPatient, getPatient, searchPatients, updatePatient, deletePatient };
