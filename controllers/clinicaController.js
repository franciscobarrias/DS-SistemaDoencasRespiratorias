const db = require('../config/db');
const { computeCaratFromAnswers, recommendationsFromInterpretation } = require('../carat');
const { validationResult } = require('express-validator');

exports.mensagemRaiz = (req, res) => res.json({ message: 'SaudINOB API pronta' });

exports.getMedicos = (req, res) => {
    db.all('SELECT * FROM Medico', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ medicos: rows });
    });
};

exports.getSintomas = (req, res) => {
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
    db.all('SELECT * FROM AvaliacaoCARAT ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ avaliacoes: rows });
    });
};

// 🛡️ A FUNÇÃO DE MESTRE: Avaliação + Lógica de Negócio (Alertas)
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

    // 1. Validar se o Utente existe e ir buscar o seu Médico (medico_id)
    db.get('SELECT id, medico_id FROM Utente WHERE id = ?', [utente_id], (err, utente) => {
        if (err) return res.status(500).json({ erro: 'Erro ao consultar utente', detalhes: err.message });
        if (!utente) return res.status(404).json({ erro: 'Utente não encontrado na base de dados.' });
        
        const medico_id = utente.medico_id;

        // 2. Calcular o Score CARAT e a Interpretação
        const resultado = computeCaratFromAnswers(respostasSeguras);
        const score_total = resultado.totalScore; 
        const interpretacao = resultado.interpretation || recommendationsFromInterpretation(score_total);

        // 3. Consultar a última avaliação do utente (para calcular a DETERIORAÇÃO)
        db.get('SELECT score_total FROM AvaliacaoCARAT WHERE utente_id = ? ORDER BY id DESC LIMIT 1', [utente_id], (err, lastEval) => {
            if (err) return res.status(500).json({ erro: 'Erro ao consultar última avaliação', detalhes: err.message });

            // 4. Guardar a nova avaliação na Base de Dados
            const sqlAvaliacao = 'INSERT INTO AvaliacaoCARAT (utente_id, respostas, score_total, interpretacao, data_preenchimento) VALUES (?, ?, ?, ?, ?)';
            db.run(sqlAvaliacao, [utente_id, JSON.stringify(respostasSeguras), score_total, interpretacao, data_preenchimento], function(err) {
                if (err) return res.status(500).json({ erro: 'Erro ao guardar avaliação', detalhes: err.message });

                const avaliacao_id = this.lastID; // O ID da avaliação acabada de criar
                
                // 5. A VERDADEIRA LÓGICA DE NEGÓCIO: GERAR ALERTAS CLÍNICOS
                const LIMIAR = 24; // Guião CARAT oficial: < 24 = Controlo Insuficiente
                const DELTA = 4;   // Regra de deterioração significativa (queda de 4 pontos)

                let motivoAlerta = null;
                const deterioracao = lastEval ? (lastEval.score_total - score_total) : 0;
                
                if (score_total < LIMIAR) {
                    motivoAlerta = `Score CARAT de ${score_total} (Abaixo do limiar de 24: Controlo Insuficiente). Requer reavaliação.`;
                } else if (deterioracao >= DELTA) {
                    motivoAlerta = `Deterioração significativa: O score caiu ${deterioracao} pontos face à última avaliação.`;
                }

                // Se houver motivo para alerta, vamos gravá-lo na BD!
                if (motivoAlerta) {
                    const sqlAlerta = `INSERT INTO Alerta (tipo, prioridade, estado, motivo, data_criacao, utente_id, medico_id, avaliacao_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
                    
                    db.run(sqlAlerta, ['Alerta CARAT', 'Alta', 'NOVO', motivoAlerta, data_preenchimento, utente_id, medico_id, avaliacao_id], function(err) {
                        if (err) console.error('Erro ao gerar alerta:', err);
                        
                        return res.status(201).json({
                            mensagem: 'Avaliação submetida e ALERTA CLÍNICO gerado com sucesso!',
                            score_total,
                            interpretacao,
                            alerta_gerado: true
                        });
                    });
                } else {
                    // Sem motivo para alerta (Score >= 24 e sem queda abrupta)
                    return res.status(201).json({
                        mensagem: 'Avaliação submetida com sucesso. Utente controlado.',
                        score_total,
                        interpretacao,
                        alerta_gerado: false
                    });
                }
            });
        });
    });
};