const db = require('../config/db');

// ==========================================
// UTENTES
// ==========================================
exports.getUtentes = (req, res) => {
    db.all("SELECT * FROM utentes", [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ utentes: rows });
    });
};

// ==========================================
// AVALIAÇÕES (CARAT)
// ==========================================
exports.getAvaliacoes = (req, res) => {
    db.all("SELECT * FROM avaliacoes ORDER BY data DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ avaliacoes: rows });
    });
};

exports.addAvaliacao = (req, res) => {
    const { utente_id, answers } = req.body;
    
    // Cálculo do Score CARAT (Soma das respostas)
    const score_total = answers.reduce((a, b) => a + b, 0);
    const alerta = score_total < 24;
    const interpretacao = alerta ? "Asma/Rinite não controlada" : "Asma/Rinite controlada";
    const data = new Date().toISOString();
    
    // Assumimos que a tua tabela tem a coluna "estado". O padrão é "NOVO".
    const estado = "NOVO"; 

    const sql = `INSERT INTO avaliacoes (utente_id, score_total, interpretacao, data, estado) VALUES (?, ?, ?, ?, ?)`;
    
    db.run(sql, [utente_id, score_total, interpretacao, data, estado], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        
        res.status(201).json({
            mensagem: "Avaliação registada com sucesso!",
            score_total,
            interpretacao,
            alerta,
            id: this.lastID
        });
    });
};

// ==========================================
// ALERTAS (RESOLUÇÃO) - A Nova Magia! ✨
// ==========================================
exports.atualizarAlerta = (req, res) => {
    const avaliacaoId = req.params.id;
    const novoEstado = req.body.estado;

    const sql = `UPDATE avaliacoes SET estado = ? WHERE id = ?`;
    
    db.run(sql, [novoEstado, avaliacaoId], function(err) {
        if (err) {
            console.error('❌ Erro na BD:', err.message);
            return res.status(500).json({ erro: "Erro ao atualizar a base de dados." });
        }
        res.status(200).json({ mensagem: "Alerta marcado como resolvido com sucesso!" });
    });
};

// ==========================================
// SINTOMAS
// ==========================================
exports.getSintomas = (req, res) => {
    db.all("SELECT * FROM sintomas ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ sintomas: rows });
    });
};

exports.addSintoma = (req, res) => {
    const { utente_id, descricao, severidade } = req.body;
    const sql = `INSERT INTO sintomas (utente_id, descricao, severidade) VALUES (?, ?, ?)`;
    
    db.run(sql, [utente_id, descricao, severidade], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.status(201).json({ mensagem: "Sintoma registado!", id: this.lastID });
    });
};

exports.deleteSintoma = (req, res) => {
    const sql = `DELETE FROM sintomas WHERE id = ?`;
    db.run(sql, req.params.id, function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: "Sintoma apagado com sucesso!" });
    });
};