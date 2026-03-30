const db = require('../config/db');
const { computeCaratFromAnswers, recommendationsFromInterpretation, nextStepFromInterpretation } = require('../carat');
const { validationResult } = require('express-validator');
const Ajv = require('ajv');
const caratSchema = require('../contracts/carat-request.schema.json');
const ajv = new Ajv();

exports.mensagemRaiz = (req, res) => res.json({ message: 'SaudINOB API pronta' });

exports.getMedicos = (req, res) => {
    db.all('SELECT * FROM Medico', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ medicos: rows });
    });
};

exports.getSintomas = (req, res) => {
    // 👇 Atualizado: ORDER BY id DESC para os mais recentes aparecerem primeiro!
    db.all('SELECT * FROM Sintoma ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ sintomas: rows });
    });
};

exports.addSintoma = (req, res) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) {
        return res.status(400).json({ 
            erro: "Dados inválidos detetados pelo servidor.", 
            detalhes: erros.array() 
        });
    }

    const { utente_id, descricao, severidade } = req.body;
    const data_registo = new Date().toISOString();
    
    const sql = 'INSERT INTO Sintoma (utente_id, descricao, severidade, data_registo) VALUES (?, ?, ?, ?)';
    
    db.run(sql, [utente_id, descricao, severidade, data_registo], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: 'Sintoma guardado com sucesso!' });
    });
};

exports.deleteSintoma = (req, res) => {
    const sql = 'DELETE FROM Sintoma WHERE id = ?';
    db.run(sql, req.params.id, function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: 'Sintoma apagado com sucesso!' });
    });
};

exports.getUtentes = (req, res) => {
    db.all('SELECT * FROM Utente', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ utentes: rows });
    });
};

exports.getAvaliacoes = (req, res) => {
    // 👇 Atualizado: ORDER BY id DESC para os resultados do CARAT mais recentes aparecerem no topo!
    db.all('SELECT * FROM AvaliacaoCARAT ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ avaliacoes: rows });
    });
};

exports.addAvaliacao = (req, res) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) {
        return res.status(400).json({ 
            erro: "Dados inválidos detetados pelo servidor.", 
            detalhes: erros.array() 
        });
    }

    const { utente_id, respostas } = req.body;
    const respostasSeguras = respostas || [];
    const data_preenchimento = new Date().toISOString();

    const resultado = computeCaratFromAnswers(respostasSeguras);
    const score_total = resultado.totalScore; 
    const interpretacao = resultado.interpretation || recommendationsFromInterpretation(score_total);

    const sql = 'INSERT INTO AvaliacaoCARAT (utente_id, respostas, score_total, interpretacao, data_preenchimento) VALUES (?, ?, ?, ?, ?)';
    
    db.run(sql, [utente_id, JSON.stringify(respostasSeguras), score_total, interpretacao, data_preenchimento], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: 'Avaliação submetida com sucesso.', score_total, interpretacao });
    });
};

exports.addCaratEvaluation = (req, res) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) {
        return res.status(400).json({
            erro: "Dados inválidos detetados pelo servidor.",
            detalhes: erros.array()
        });
    }
    const utenteId = parseInt(req.params.id, 10);
    const payload = req.body;

    // 1. Validar payload com schema JSON
    const validate = ajv.compile(caratSchema);
    if (!validate(payload)) {
        return res.status(400).json({
            erro: "Payload inválido",
            detalhes: validate.errors
        });
    }

    // 2. Validar se utente existe e obter medico_id
    db.get('SELECT id, medico_id FROM Utente WHERE id = ?', [utenteId], (err, utente) => {
        if (err) {
            return res.status(500).json({ erro: 'Erro ao consultar utente', detalhes: err.message });
        }
        if (!utente) {
            return res.status(404).json({ erro: 'Utente não encontrado' });
        }
        const medicoId = utente.medico_id;

        // 3. Calcular score e interpretação
        const { totalScore, interpretation } = computeCaratFromAnswers(payload.answers);

        // 4. Gerar recomendações e próximo passo
        const recommendations = recommendationsFromInterpretation(interpretation);
        const nextStep = nextStepFromInterpretation(interpretation);

        // 5. Consultar última avaliação do utente
        db.get(
            'SELECT score_total FROM AvaliacaoCARAT WHERE utente_id = ? ORDER BY data DESC LIMIT 1',
            [utenteId],
            (err, lastEval) => {
                if (err) {
                    return res.status(500).json({ erro: 'Erro ao consultar última avaliação', detalhes: err.message });
                }

                // 6. Guardar avaliação na base de dados
                const respostasStr = JSON.stringify(payload.answers);
                db.run(
                    'INSERT INTO AvaliacaoCARAT (respostas, score_total, interpretacao, utente_id) VALUES (?, ?, ?, ?)',
                    [respostasStr, totalScore, interpretation, utenteId],
                    function (err) {
                        if (err) {
                            return res.status(500).json({ erro: 'Erro ao guardar avaliação', detalhes: err.message });
                        }

                        const avaliacaoId = this.lastID;
                        // 7. Gerar alerta se necessário
                        const LIMIAR = 16; // Exemplo: limiar de controlo insuficiente
                        const DELTA = 4;   // Exemplo: deterioração relevante

                        let alertaGerado = false;

                        const deterioracao = lastEval ? (lastEval.score_total - totalScore) : 0;
                        const motivo = (totalScore < LIMIAR)
                            ? 'Score CARAT abaixo do limiar'
                            : (deterioracao >= DELTA)
                                ? 'Deterioração significativa face à última avaliação'
                                : null;

                        if (motivo) {
                            alertaGerado = true;
                            db.run(
                                `INSERT INTO Alerta (tipo, prioridade, estado, motivo, medico_id, utente_id, avaliacao_id)
                                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                [
                                    'CARAT',
                                    'Alta',
                                    'NOVO',
                                    motivo,
                                    medicoId,
                                    utenteId,
                                    avaliacaoId
                                ],
                                function (err) {
                                    if (err) {
                                        // Erro ao criar alerta, mas avaliação foi criada
                                        return res.status(201).json({
                                            avaliacaoId,
                                            score: totalScore,
                                            interpretacao: interpretation,
                                            recomendacoes: recommendations,
                                            proximoPasso: nextStep,
                                            alertaGerado: false,
                                            erroAlerta: 'Erro ao criar alerta: ' + err.message
                                        });
                                    }
                                    res.status(201).json({
                                        avaliacaoId,
                                        score: totalScore,
                                        interpretacao: interpretation,
                                        recomendacoes: recommendations,
                                        proximoPasso: nextStep,
                                        alertaGerado: true
                                    });
                                }
                            );
                        } else {
                            res.status(201).json({
                                avaliacaoId,
                                score: totalScore,
                                interpretacao: interpretation,
                                recomendacoes: recommendations,
                                proximoPasso: nextStep,
                                alertaGerado: false
                            });
                        }
                    }
                );
            }
        );
    });
};