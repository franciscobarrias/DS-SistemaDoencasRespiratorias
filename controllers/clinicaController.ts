const db = require('../config/db'); // Garante que o caminho está correto para config/db.js
const caratEngine = require('../carat'); 
const Ajv = require('ajv');
const fhirService = require('../services/fhir.services');
const caratSchema = require('../schemas/carat-request.schema.json');
const alertPatchSchema = require('../schemas/alert-patch.schema.json');
const sintomaSchema = require('../schemas/sintoma-request.schema.json');

const ajv = new Ajv();
const validateCaratRequest = ajv.compile(caratSchema);
const validateAlertPatch = ajv.compile(alertPatchSchema);
const validateSintomaRequest = ajv.compile(sintomaSchema);

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
    });
});

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
    });
});

const ensureFhirIdColumn = async () => {
    try {
        const cols = await dbAll('PRAGMA table_info(utentes)');
        const hasFhirCol = Array.isArray(cols) && cols.some((c) => c.name === 'fhir_id');
        if (!hasFhirCol) {
            await dbRun('ALTER TABLE utentes ADD COLUMN fhir_id TEXT');
        }
    } catch (err) {
        console.error('Failed to ensure fhir_id column exists', err);
    }
};

const persistFhirId = async (utenteId, fhirId) => {
    if (!fhirId) return;
    await ensureFhirIdColumn();
    await dbRun('UPDATE utentes SET fhir_id = ? WHERE id = ?', [fhirId, utenteId]);
};

const clinicaController = {
    // US06: Listar todos os utentes para o Dashboard
    getAllUtentes: (req, res) => {
        db.all("SELECT * FROM utentes", [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    },

    // Sincronizar utentes antigos sem fhir_id com o servidor FHIR
    syncLegacyUtentesToFhir: async (req, res) => {
        try {
            const utentes = await dbAll(
                "SELECT id, nome, email, telefone, fhir_id FROM utentes WHERE fhir_id IS NULL OR TRIM(COALESCE(fhir_id, '')) = '' ORDER BY id ASC"
            );

            const errors = [];
            let synced = 0;

            for (const utente of utentes) {
                try {
                    const fhirRes = await fhirService.createPatient({
                        id: utente.id,
                        nome: utente.nome,
                        email: utente.email || '',
                        telefone: utente.telefone || ''
                    });

                    const fhirId = fhirRes && fhirRes.id ? String(fhirRes.id) : null;
                    if (!fhirId) {
                        errors.push({ id: utente.id, nome: utente.nome, error: 'FHIR sem id devolvido' });
                        continue;
                    }

                    await persistFhirId(utente.id, fhirId);
                    synced += 1;
                } catch (err) {
                    errors.push({ id: utente.id, nome: utente.nome, error: String(err) });
                }
            }

            return res.status(200).json({
                total: utentes.length,
                synced,
                errors: errors.length,
                errorDetails: errors
            });
        } catch (err) {
            return res.status(500).json({ error: String(err) });
        }
    },

    // 🛡️ NOVA FUNÇÃO: Gravar novo utente na base de dados
    addUtente: (req, res) => {
        const { nome, email, telefone } = req.body;
        
        // Validação básica
        if (!nome) return res.status(400).json({ error: "Nome é obrigatório." });

        db.run("INSERT INTO utentes (nome, email, telefone) VALUES (?, ?, ?)",
            [nome, email || '', telefone || ''], async function(err) {
            if (err) return res.status(500).json({ error: err.message });

            const newId = this.lastID;
            const utenteObj = { id: newId, nome, email: email || '', telefone: telefone || '' };

            // Tentar criar o Patient no servidor FHIR — não falhará a criação local se o FHIR falhar.
            try {
                const fhirRes: any = await fhirService.createPatient(utenteObj);
                const fhirId = fhirRes && fhirRes.id ? fhirRes.id : null;

                if (fhirId) {
                    await persistFhirId(newId, fhirId);
                    return res.status(201).json({ id: newId, mensagem: "Utente adicionado com sucesso", fhirId });
                } else {
                    return res.status(201).json({ id: newId, mensagem: "Utente adicionado com sucesso (FHIR sem id retornado)", fhirResponse: fhirRes });
                }
            } catch (ferr) {
                console.error('FHIR create failed for utente', newId, ferr);
                return res.status(201).json({ id: newId, mensagem: "Utente adicionado com sucesso (FHIR falhou)", fhirError: String(ferr) });
            }
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

        // Validação com Ajv
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
        // Validação opcional se enviarem dados no corpo
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
    getSintomas: (req, res) => {
        const idTexto = String(req.params.utente_id);
        const idNumero = parseInt(idTexto) || 0;
        
        db.all("SELECT * FROM sintomas WHERE utente_id = ? OR utente_id = ?", [idTexto, idNumero], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    },

    // Trazer TODOS os sintomas (Para a visão Global)
    getAllSintomas: (req, res) => {
        db.all("SELECT * FROM sintomas ORDER BY id DESC", [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    },

    // Gravar um novo sintoma na Base de Dados com Validação Ajv
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

    // Eliminar o sintoma da Base de Dados
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
    },

    // ==========================================
    // 🛡️ REINSERIDO: Gestão de Terapêutica
    // ==========================================
    getTerapeutica: (req, res) => {
        const { id } = req.params;
        db.all("SELECT * FROM terapeutica WHERE utente_id = ? ORDER BY data_inicio DESC", [id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    },

    addMedicamento: (req, res) => {
        const { id } = req.params;
        const { medicamento, posologia } = req.body;
        
        if (!medicamento) return res.status(400).json({ error: "O nome do medicamento é obrigatório." });

        db.run("INSERT INTO terapeutica (utente_id, medicamento, posologia) VALUES (?, ?, ?)",
            [id, medicamento, posologia || ''], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id: this.lastID, mensagem: "Medicamento adicionado com sucesso!" });
        });
    }
};

module.exports = clinicaController;

export {};