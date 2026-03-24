const test = require('node:test');
const assert = require('node:assert/strict');

const {
    computeCaratFromAnswers,
    recommendationsFromInterpretation,
    nextStepFromInterpretation,
} = require('../carat');

test('computeCaratFromAnswers returns controlled level', () => {
    const result = computeCaratFromAnswers({ q1: 4, q2: 4, q3: 4, q4: 4, q5: 4, q6: 4 });
    assert.equal(result.totalScore, 24);
    assert.equal(result.interpretation, 'Controlado');
});

test('computeCaratFromAnswers returns partially controlled level', () => {
    const result = computeCaratFromAnswers({ q1: 4, q2: 4, q3: 4, q4: 2, q5: 1, q6: 1 });
    assert.equal(result.totalScore, 16);
    assert.equal(result.interpretation, 'Parcialmente controlado');
});

test('computeCaratFromAnswers returns uncontrolled level', () => {
    const result = computeCaratFromAnswers({ q1: 2, q2: 2, q3: 2, q4: 2, q5: 2 });
    assert.equal(result.totalScore, 10);
    assert.equal(result.interpretation, 'Nao controlado');
});

test('recommendations and next step exist for all interpretation levels', () => {
    for (const level of ['Controlado', 'Parcialmente controlado', 'Nao controlado']) {
        const recs = recommendationsFromInterpretation(level);
        assert.ok(Array.isArray(recs));
        assert.ok(recs.length > 0);
        assert.ok(typeof nextStepFromInterpretation(level) === 'string');
    }
});
