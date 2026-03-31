const db = require('../config/db');
const { computeCaratFromAnswers } = require('../carat');
const { validationResult } = require('express-validator');

// --- INFORMAÇÃO GERAL ---

exports.mensagemRaiz = (req, res) => res.json({ message: 'SaudINOB API Pronta' });

exports.getMedicos = (req, res) => {
    db.all('SELECT * FROM Medico', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ medicos: rows });
    });
};

exports.getUtentes = (req, res) => {
    db.all('SELECT * FROM Utente', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ utentes: rows });
    });
};

exports.getSintomas = (req, res) => {
    db.all('SELECT * FROM Sintoma ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ sintomas: rows });
    });
};

exports.getAvaliacoes = (req, res) => {
    db.all('SELECT * FROM AvaliacaoCARAT ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ avaliacoes: rows });
    });
};

// --- GESTÃO DE SINTOMAS ---

exports.addSintoma = (req, res) => {
    // Verificar se o express-validator detetou erros simples
    const erros = validationResult(req);
    if (!erros.isEmpty()) return res.status(400).json({ erros: erros.array() });

    const { utente_id, descricao, severidade } = req.body;
    const sql = 'INSERT INTO Sintoma (utente_id, descricao, severidade) VALUES (?, ?, ?)';
    
    db.run(sql, [utente_id, descricao, severidade], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.status(201).json({ mensagem: 'Sintoma registado com sucesso!', id: this.lastID });
    });
};

exports.deleteSintoma = (req, res) => {
    db.run('DELETE FROM Sintoma WHERE id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: 'Sintoma removido.' });
    });
};

// --- LÓGICA CORE: AVALIAÇÕES E ALERTAS ---

exports.addAvaliacao = (req, res) => {
    // 1. O AJV já garantiu que 'utente_id' e 'answers' (ou respostas) estão corretos
    const { utente_id, answers } = req.body; 
    const respostas = answers; // Mapeamento do teu JSON Schema
    const data_agora = new Date().toISOString();

    // 2. Buscar o Médico do Utente para saber a quem enviar o alerta
    db.get('SELECT medico_id FROM Utente WHERE id = ?', [utente_id], (err, utente) => {
        if (err) return res.status(500).json({ erro: 'Erro ao buscar utente' });
        if (!utente) return res.status(404).json({ erro: 'Utente não existe' });

        const medico_id = utente.medico_id;

        // 3. Calcular Score (Lógica isolada no carat.js)
        const resultado = computeCaratFromAnswers(respostas);
        const { totalScore, interpretation } = resultado;

        // 4. Verificar deterioração (comparar com a última avaliação)
        db.get('SELECT score_total FROM AvaliacaoCARAT WHERE utente_id = ? ORDER BY id DESC LIMIT 1', [utente_id], (err, lastEval) => {
            
            // 5. Guardar Avaliação
            const sqlAval = 'INSERT INTO AvaliacaoCARAT (utente_id, respostas, score_total, interpretacao, data) VALUES (?, ?, ?, ?, ?)';
            db.run(sqlAval, [utente_id, JSON.stringify(respostas), totalScore, interpretation, data_agora], function(err) {
                if (err) return res.status(500).json({ erro: 'Erro ao guardar avaliação' });

                const avaliacao_id = this.lastID;
                const LIMIAR_CLINICO = 24;
                const QUEDA_GRAVE = 4;
                let motivoAlerta = null;

                // Lógica de Alerta
                if (totalScore < LIMIAR_CLINICO) {
                    motivoAlerta = `Controlo insuficiente (Score: ${totalScore}).`;
                } else if (lastEval && (lastEval.score_total - totalScore >= QUEDA_GRAVE)) {
                    motivoAlerta = `Deterioração clínica significativa (Queda de ${lastEval.score_total - totalScore} pontos).`;
                }

                if (motivoAlerta) {
                    const sqlAlerta = 'INSERT INTO Alerta (tipo, prioridade, estado, motivo, utente_id, medico_id, avaliacao_id) VALUES (?, ?, ?, ?, ?, ?, ?)';
                    db.run(sqlAlerta, ['CARAT', 'Alta', 'NOVO', motivoAlerta, utente_id, medico_id, avaliacao_id]);
                }

                res.status(201).json({
                    mensagem: motivoAlerta ? 'Avaliação guardada com ALERTA gerado!' : 'Avaliação guardada com sucesso.',
                    score_total: totalScore,
                    interpretacao: interpretation,
                    alerta: !!motivoAlerta
                });
            });
        });
    });
};

// --- GESTÃO DE ALERTAS (PATCH) ---

exports.updateAlerta = (req, res) => {
    const { id } = req.params;
    const { estado, prioridade } = req.body;

    // Construção dinâmica da query baseada no que o médico quer mudar
    let campos = [];
    let valores = [];
    if (estado) { campos.push("estado = ?"); valores.push(estado); }
    if (prioridade) { campos.push("prioridade = ?"); valores.push(prioridade); }
    
    valores.push(id);

    const sql = `UPDATE Alerta SET ${campos.join(', ')} WHERE id = ?`;

    db.run(sql, valores, function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        if (this.changes === 0) return res.status(404).json({ erro: "Alerta não encontrado." });
        res.json({ mensagem: "Alerta atualizado com sucesso!" });
    });
};