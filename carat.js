function computeCaratFromAnswers(answers) {
    const values = Object.values(answers || {});
    const totalScore = values.reduce((sum, value) => sum + Number(value || 0), 0);

    let interpretation = 'Nao controlado';
    if (totalScore >= 24) {
        interpretation = 'Controlado';
    } else if (totalScore >= 16) {
        interpretation = 'Parcialmente controlado';
    }

    return {
        totalScore,
        interpretation,
    };
}

function recommendationsFromInterpretation(interpretation) {
    if (interpretation === 'Controlado') {
        return [
            'Manter plano terapeutico atual.',
            'Reforcar adesao ao autocuidado e monitorizacao semanal.',
        ];
    }

    if (interpretation === 'Parcialmente controlado') {
        return [
            'Rever tecnica inalatória e adesao terapeutica.',
            'Vigiar sinais de agravamento e repetir CARAT em 2 semanas.',
        ];
    }

    return [
        'Agendar revisao clinica com prioridade.',
        'Avaliar necessidade de ajuste terapeutico e exames complementares.',
        'Se houver dispneia importante ou agravamento rapido, procurar cuidados urgentes.',
    ];
}

function nextStepFromInterpretation(interpretation) {
    if (interpretation === 'Controlado') return 'Repetir avaliacao em 6-8 semanas.';
    if (interpretation === 'Parcialmente controlado') return 'Repetir avaliacao em 2-4 semanas.';
    return 'Repetir avaliacao em 1 semana e rever plano com medico.';
}

module.exports = {
    computeCaratFromAnswers,
    recommendationsFromInterpretation,
    nextStepFromInterpretation,
};
