function mapObservation(resource: any): any {
    const coding0 = resource?.code?.coding?.[0] || {};
    const display = resource?.code?.text || coding0.display || coding0.code || '';

    let value = '';
    let unit = '';
    let valueType = '';

    if (resource?.valueQuantity && resource.valueQuantity.value !== undefined && resource.valueQuantity.value !== null) {
        value = String(resource.valueQuantity.value);
        unit = resource.valueQuantity.unit || resource.valueQuantity.code || '';
        valueType = 'valueQuantity';
    } else if (typeof resource?.valueString === 'string') {
        value = resource.valueString;
        valueType = 'valueString';
    } else if (resource?.valueCodeableConcept) {
        value = resource.valueCodeableConcept.text
            || resource.valueCodeableConcept?.coding?.[0]?.display
            || resource.valueCodeableConcept?.coding?.[0]?.code
            || '';
        valueType = 'valueCodeableConcept';
    }

    return {
        id: resource.id,
        status: resource.status,
        code: coding0.code || '',
        display,
        value,
        unit,
        valueType,
        codeText: resource?.code?.text || '',
        codeDisplay: coding0.display || '',
        effectiveDateTime: formatarDataPortuguesa(resource.effectiveDateTime),
        effectiveDateTimeRaw: resource?.effectiveDateTime || '',
        subject: resource.subject?.reference || ''
    };
}

function formatarDataPortuguesa(dataFHIR?: string): string {
    if (!dataFHIR) return '';
    return new Date(dataFHIR).toLocaleString('pt-PT', {
        timeZone: 'Europe/Lisbon',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

module.exports = { mapObservation };

export {};
