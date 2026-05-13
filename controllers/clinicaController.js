const db = require('../config/db'); // Garante que o caminho está correto para config/db.js
const caratEngine = require('../carat'); 

const clinicaController = {
    // US06: Listar todos os utentes para o Dashboard
    getAllUtentes: (req, res) => {
        db.all("SELECT * FROM utentes", [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    },

    // US06: Listar apenas Alertas Ativos (Estado NOVO)
    getAlertas: (req, res) => {
        const query = `
            SELECT a.*, u.nome as utente_nome 
            FROM alertas a 
            JOIN utentes u ON a.utente_id = u.id 
            WHERE a.estado = 'NOVO'
            ORDER BY a.data_criacao DESC
        `;
        db.all(query, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    },

    // US03: Submeter Avaliação CARAT
    addAvaliacao: (req, res) => {
        const { utente_id, answers } = req.body;
        
        // Validação básica de segurança
        if (!utente_id || !answers) {
            return res.status(400).json({ error: "Dados incompletos." });
        }

        // Processamento pelo Motor CARAT
        const resultado = caratEngine.computeCaratFromAnswers(answers);

        const queryAval = `
            INSERT INTO avaliacoes_carat (utente_id, respostas, score_total, interpretacao, conclusao) 
            VALUES (?, ?, ?, ?, ?)
        `;

        db.run(queryAval, [
            utente_id, 
            JSON.stringify(answers), 
            resultado.totalScore, 
            resultado.interpretation, 
            "Avaliação via Fast CARAT"
        ], function(err) {
            if (err) return res.status(500).json({ error: err.message });

            const avaliacaoId = this.lastID;

            // Lógica de Geração de Alerta Automático (Score < 24)
            if (resultado.totalScore < 24) {
                const queryAlerta = `
                    INSERT INTO alertas (utente_id, avaliacao_id, tipo, prioridade) 
                    VALUES (?, ?, ?, ?)
                `;
                db.run(queryAlerta, [utente_id, avaliacaoId, 'Controlo Insuficiente', 'Alta']);
            }

            res.status(201).json({ 
                mensagem: "Avaliação submetida com sucesso!", 
                score_total: resultado.totalScore,
                interpretacao: resultado.interpretation
            });
        });
    },

    // US06: Resolver/Fechar Alerta
    resolverAlerta: (req, res) => {
        const { id } = req.params;
        db.run("UPDATE alertas SET estado = 'FECHADO' WHERE id = ?", [id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Alerta marcado como resolvido." });
        });
    },

    // US04: Obter histórico de um utente (para o gráfico temporal)
    getHistoricoUtente: (req, res) => {
        const { id } = req.params;
        db.all("SELECT data, score_total FROM avaliacoes_carat WHERE utente_id = ? ORDER BY data ASC", [id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    },

    // Obter sintomas de um utente (para o gráfico de donuts)
    getSintomas: (req, res) => {
        const { utente_id } = req.params;
        db.all("SELECT * FROM sintomas WHERE utente_id = ?", [utente_id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    }
};

module.exports = clinicaController;