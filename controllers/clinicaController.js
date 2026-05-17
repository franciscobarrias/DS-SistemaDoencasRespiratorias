const db = require('../config/db'); // Garante que o caminho está correto para config/db.js
const caratEngine = require('../carat'); 
const Ajv = require('ajv');
const caratSchema = require('../schemas/carat-request.schema.json');
const alertPatchSchema = require('../schemas/alert-patch.schema.json');
const sintomaSchema = require('../schemas/sintoma-request.schema.json');
const ajv = new Ajv();
const validateCaratRequest = ajv.compile(caratSchema);
const validateAlertPatch = ajv.compile(alertPatchSchema);
const validateSintomaRequest = ajv.compile(sintomaSchema);

const clinicaController = {
    // US06: Listar todos os utentes para o Dashboard
    getAllUtentes: (req, res) => {
        db.all("SELECT * FROM utentes", [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    },

    // 🛡️ NOVA FUNÇÃO: Gravar novo utente na base de dados
    addUtente: (req, res) => {
        const { nome, email, telefone } = req.body;
        
        // Validação básica
        if (!nome) return res.status(400).json({ error: "Nome é obrigatório." });

        db.run("INSERT INTO utentes (nome, email, telefone) VALUES (?, ?, ?)",
            [nome, email || '', telefone || ''], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id: this.lastID, mensagem: "Utente adicionado com sucesso" });
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
        const body = req.body;

        // Validate request body against JSON Schema using Ajv
        const valid = validateCaratRequest(body);
        if (!valid) {
            return res.status(400).json({ error: 'Corpo inválido', details: validateCaratRequest.errors });
        }

        const { utente_id, answers } = body;

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
        // If client provided estado/prioridade in body, validate it
        const body = req.body || {};
        const shouldValidate = Object.prototype.hasOwnProperty.call(body, 'estado') || Object.prototype.hasOwnProperty.call(body, 'prioridade');
        if (shouldValidate) {
            const valid = validateAlertPatch(body);
            if (!valid) return res.status(400).json({ error: 'Corpo inválido para alerta', details: validateAlertPatch.errors });
        }

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

    // Obter sintomas de um utente específico
    // 🛡️ CORRIGIDO: Força o SQLite a procurar texto E número
    getSintomas: (req, res) => {
        const idTexto = String(req.params.utente_id);
        const idNumero = parseInt(idTexto) || 0;
        
        db.all("SELECT * FROM sintomas WHERE utente_id = ? OR utente_id = ?", [idTexto, idNumero], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    },

    // ==========================================
    // 🛡️ NOVA FUNÇÃO: Trazer TODOS os sintomas (Para a visão Global)
    // ==========================================
    getAllSintomas: (req, res) => {
        db.all("SELECT * FROM sintomas ORDER BY id DESC", [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    },

    // ==========================================
    // AS FUNÇÕES RESTANTES ESTÃO AQUI ABAIXO
    // ==========================================

    // Gravar um novo sintoma na Base de Dados (Resolve o Erro 404)
    addSintoma: (req, res) => {
        const body = req.body || {};
        const valid = validateSintomaRequest(body);
        if (!valid) return res.status(400).json({ error: 'Corpo inválido para sintoma', details: validateSintomaRequest.errors });

        const { utente_id, descricao, severidade } = body;
        db.run("INSERT INTO sintomas (utente_id, descricao, severidade) VALUES (?, ?, ?)",
            [utente_id, descricao, severidade], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id: this.lastID, mensagem: "Sintoma gravado com sucesso" });
        });
    },

    // 🛡️ NOVA FUNÇÃO INTEGRADA: Eliminar o sintoma da Base de Dados
    deleteSintoma: (req, res) => {
        const { id } = req.params;
        db.run("DELETE FROM sintomas WHERE id = ?", [id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Sintoma eliminado com sucesso." });
        });
    },

    // Listar as avaliações CARAT para alimentar a tabela do Dashboard
    getAvaliacoes: (req, res) => {
        db.all("SELECT * FROM avaliacoes_carat ORDER BY data DESC", [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    }
};

module.exports = clinicaController;