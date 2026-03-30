const db = require('../config/db');
const { computeCaratFromAnswers, recommendationsFromInterpretation } = require('../carat');

exports.mensagemRaiz = (req, res) => res.json({ message: 'SaudINOB API pronta' });

exports.getMedicos = (req, res) => {
    db.all('SELECT * FROM Medico', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ medicos: rows });
    });
};

exports.getSintomas = (req, res) => {
    db.all('SELECT * FROM Sintoma', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ sintomas: rows });
    });
};

exports.addSintoma = (req, res) => {
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
    db.all('SELECT * FROM AvaliacaoCARAT', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ avaliacoes: rows });
    });
};

exports.addAvaliacao = (req, res) => {
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