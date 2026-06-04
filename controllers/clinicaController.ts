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

// Resolver fetch no ambiente servidor (Node 18+ tem global fetch)
let _fetch: typeof fetch | undefined;
if (typeof globalThis.fetch === 'function') {
    // @ts-ignore
    _fetch = globalThis.fetch.bind(globalThis);
} else {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        _fetch = require('node-fetch');
    } catch (err) {
        console.error('Aviso: fetch não disponível no servidor. Instale Node 18+ ou node-fetch para integrações FHIR.');
    }
}

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

const ensureNumeroIdentidadeColumn = async () => {
    try {
        const cols = await dbAll('PRAGMA table_info(utentes)');
        const hasCol = Array.isArray(cols) && cols.some((c) => c.name === 'numero_identidade');
        if (!hasCol) {
            await dbRun('ALTER TABLE utentes ADD COLUMN numero_identidade TEXT');
        }
    } catch (err) {
        console.error('Failed to ensure numero_identidade column exists', err);
    }
};

const ensureMedicosColumns = async () => {
    try {
        const cols = await dbAll('PRAGMA table_info(medicos)');
        const hasTelefone = Array.isArray(cols) && cols.some((c) => c.name === 'telefone');
        const hasStatus = Array.isArray(cols) && cols.some((c) => c.name === 'status');

        if (!hasTelefone) {
            await dbRun('ALTER TABLE medicos ADD COLUMN telefone TEXT');
        }

        if (!hasStatus) {
            await dbRun("ALTER TABLE medicos ADD COLUMN status TEXT DEFAULT 'Ativo'");
        }

        await dbRun("UPDATE medicos SET status = 'Ativo' WHERE status IS NULL OR TRIM(COALESCE(status, '')) = ''");
    } catch (err) {
        console.error('Failed to ensure medicos columns exist', err);
    }
};

const persistFhirId = async (utenteId, fhirId) => {
    if (!fhirId) return;
    await ensureFhirIdColumn();
    await dbRun('UPDATE utentes SET fhir_id = ? WHERE id = ?', [fhirId, utenteId]);
};

const persistNumeroIdentidade = async (utenteId, numeroIdentidade) => {
    if (!numeroIdentidade) return;
    await ensureNumeroIdentidadeColumn();
    await dbRun('UPDATE utentes SET numero_identidade = ? WHERE id = ?', [numeroIdentidade, utenteId]);
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const extractFhirPatientIdentifiers = (patient) => {
    const identifiers = new Set();
    if (patient?.id) identifiers.add(String(patient.id));
    const patientIdentifiers = Array.isArray(patient?.identifier) ? patient.identifier : [];
    patientIdentifiers.forEach((identifier) => {
        if (identifier?.value) identifiers.add(String(identifier.value));
    });
    return [...identifiers];
};

const clinicaController = {
    // US06: Listar todos os utentes para o Dashboard
    getAllUtentes: (req, res) => {
        db.all("SELECT * FROM utentes", [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    },

    // Sincronizar todos os Patients do FHIR para BD local (descoberta automática)
    syncAllFhirPatients: async (req, res) => {
        try {
            console.log('[FHIR Sync] Iniciando sincronização de todos os patients do FHIR...');
            await ensureFhirIdColumn();
            await ensureNumeroIdentidadeColumn();

            // Buscar todos os patients do FHIR
            let allPatients: any[] = [];
            
            try {
                const fhirBundle = await fhirService.searchPatients({ _count: 1000 });
                
                console.log('[FHIR Sync] Bundle recebido:', { 
                    hasEntry: !!fhirBundle.entry,
                    entryCount: fhirBundle.entry?.length || 0,
                    hasLink: !!fhirBundle.link 
                });

                if (fhirBundle.entry && Array.isArray(fhirBundle.entry)) {
                    allPatients.push(...fhirBundle.entry.map((e: any) => e.resource).filter((p: any) => p?.resourceType === 'Patient'));
                    console.log(`[FHIR Sync] Encontrados ${allPatients.length} patients no FHIR`);
                }
            } catch (searchErr) {
                console.error('[FHIR Sync] Erro ao buscar patients:', searchErr);
                throw searchErr;
            }

            if (allPatients.length === 0) {
                console.log('[FHIR Sync] Nenhum patient encontrado no FHIR');
                return res.status(200).json({
                    total: 0,
                    imported: 0,
                    errors: 0,
                    errorDetails: [],
                    mensagem: 'Nenhum patient encontrado no servidor FHIR'
                });
            }

            // Verificar quais já existem localmente por fhir_id, email ou número de identidade
            const existingUtentes = await dbAll('SELECT id, nome, email, numero_identidade, fhir_id FROM utentes') as Array<{ id: number; nome: string; email?: string; numero_identidade?: string; fhir_id?: string }>;
            const existingFhirIds = new Set(existingUtentes.map(u => normalizeText(u.fhir_id)).filter(Boolean));
            const existingEmails = new Set(existingUtentes.map(u => normalizeText(u.email)).filter(Boolean));
            const existingNumerosIdentidade = new Set(existingUtentes.map(u => normalizeText(u.numero_identidade)).filter(Boolean));

            console.log(`[FHIR Sync] ${existingUtentes.length} utentes já existem localmente`);

            // Importar novos patients
            let imported = 0;
            const errors = [];

            for (const patient of allPatients) {
                if (!patient.id) {
                    console.warn('[FHIR Sync] Patient sem ID, pulando');
                    continue;
                }
                
                const patientIdentifiers = extractFhirPatientIdentifiers(patient);
                const patientEmail = normalizeText(patient.telecom?.find((t: any) => t.system === 'email')?.value);
                const patientNumeroIdentidade = normalizeText(patient.identifier?.find((i: any) => i.system === 'urn:local:utente-id')?.value || patient.identifier?.[0]?.value);

                const alreadyExists =
                    existingFhirIds.has(normalizeText(patient.id)) ||
                    (patientEmail && existingEmails.has(patientEmail)) ||
                    (patientNumeroIdentidade && existingNumerosIdentidade.has(patientNumeroIdentidade)) ||
                    patientIdentifiers.some((value) => existingNumerosIdentidade.has(normalizeText(value)));

                if (alreadyExists) {
                    console.log(`[FHIR Sync] Patient ${patient.id} já existe localmente (fhir_id/email/identidade), pulando...`);
                    continue;
                }

                try {
                    // Extrair dados do patient FHIR
                    const names = patient.name?.[0] || {};
                    const given = Array.isArray(names.given) ? names.given.join(' ') : (names.given || '');
                    const family = names.family || '';
                    const nome = `${given} ${family}`.trim() || 'Paciente Sem Nome';

                    const telecom = patient.telecom || [];
                    const email = telecom.find((t: any) => t.system === 'email')?.value || '';
                    const telefone = telecom.find((t: any) => t.system === 'phone')?.value || '';
                    const numeroIdentidade = patient.identifier?.find((i: any) => i.system === 'urn:local:utente-id')?.value
                        || patient.identifier?.[0]?.value
                        || '';

                    // Inserir na BD
                    const result = await new Promise((resolve, reject) => {
                        db.run(
                            'INSERT INTO utentes (nome, email, telefone, fhir_id, numero_identidade) VALUES (?, ?, ?, ?, ?)',
                            [nome, email, telefone, patient.id, numeroIdentidade || null],
                            function(err) {
                                if (err) return reject(err);
                                resolve({ id: this.lastID });
                            }
                        );
                    });

                    if (numeroIdentidade) {
                        await persistNumeroIdentidade((result as any).id, numeroIdentidade);
                    }

                    console.log(`[FHIR Sync] Patient ${patient.id} (${nome}) importado com sucesso`);
                    imported++;
                } catch (err) {
                    console.error(`[FHIR Sync] Erro ao importar patient ${patient.id}:`, err);
                    errors.push({ fhirId: patient.id, error: String(err) });
                }
            }

            console.log(`[FHIR Sync] Sincronização concluída: ${imported} patients importados, ${errors.length} erros`);

            return res.status(200).json({
                total: allPatients.length,
                imported,
                errors: errors.length,
                errorDetails: errors,
                mensagem: `Sincronização concluída: ${imported}/${allPatients.length} patients importados`
            });
        } catch (err) {
            console.error('[FHIR Sync] Erro crítico:', err);
            return res.status(500).json({ error: String(err) });
        }
    },

    // Importar Patient do FHIR para BD local
    importUtenteFromFhir: async (req, res) => {
        try {
            const { fhirId } = req.params;
            if (!fhirId) return res.status(400).json({ error: 'FHIR ID é obrigatório' });

            console.log(`[FHIR Import] Tentando importar Patient com ID: ${fhirId}`);

            // Buscar Patient do FHIR
            const fhirPatient = await fhirService.getPatientFromFhir(fhirId);
            if (!fhirPatient) return res.status(404).json({ error: 'Patient não encontrado no FHIR' });

            console.log(`[FHIR Import] Patient encontrado:`, fhirPatient);

            // Extrair dados
            const names = fhirPatient.name?.[0] || {};
            const given = Array.isArray(names.given) ? names.given.join(' ') : (names.given || '');
            const family = names.family || '';
            const nome = `${given} ${family}`.trim() || 'Paciente Sem Nome';

            const telecom = fhirPatient.telecom || [];
            const email = telecom.find((t: any) => t.system === 'email')?.value || '';
            const telefone = telecom.find((t: any) => t.system === 'phone')?.value || '';

            console.log(`[FHIR Import] Dados extraídos - Nome: ${nome}, Email: ${email}, Tel: ${telefone}`);

            // Inserir na BD local com FHIR ID
            const result = await new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO utentes (nome, email, telefone, fhir_id) VALUES (?, ?, ?, ?)',
                    [nome, email, telefone, fhirId],
                    function(err) {
                        if (err) return reject(err);
                        resolve({ id: this.lastID });
                    }
                );
            });

            console.log(`[FHIR Import] Utente importado com sucesso - ID local: ${(result as any).id}`);

            return res.status(201).json({
                id: (result as any).id,
                nome,
                email,
                telefone,
                fhir_id: fhirId,
                mensagem: 'Paciente importado com sucesso do FHIR'
            });
        } catch (err) {
            console.error(`[FHIR Import] Erro:`, err);
            return res.status(500).json({ error: String(err) });
        }
    },

    // Sincronizar utentes antigos sem fhir_id com o servidor FHIR
    syncLegacyUtentesToFhir: async (req, res) => {
        try {
            const utentes = await dbAll(
                "SELECT id, nome, email, telefone, fhir_id FROM utentes WHERE fhir_id IS NULL OR TRIM(COALESCE(fhir_id, '')) = '' ORDER BY id ASC"
            ) as Array<{ id: number; nome: string; email?: string; telefone?: string; fhir_id?: string | null }>;

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
        const { nome, email, telefone, medico_id, numero_identidade } = req.body;
        
        // Validação básica
        if (!nome) return res.status(400).json({ error: "Nome é obrigatório." });

        (async () => {
            await ensureFhirIdColumn();
            await ensureNumeroIdentidadeColumn();
            db.run("INSERT INTO utentes (nome, email, telefone, medico_id, numero_identidade) VALUES (?, ?, ?, ?, ?)",
            [nome, email || '', telefone || '', medico_id || null, numero_identidade || null], async function(err) {
            if (err) return res.status(500).json({ error: err.message });

            const newId = this.lastID;
            const utenteObj = { id: newId, nome, email: email || '', telefone: telefone || '', numero_identidade: numero_identidade || '' };

            // Tentar criar o Patient no servidor FHIR — não falhará a criação local se o FHIR falhar.
            try {
                const fhirRes: any = await fhirService.createPatient(utenteObj);
                const fhirId = fhirRes && fhirRes.id ? fhirRes.id : null;

                if (fhirId) {
                    await persistFhirId(newId, fhirId);
                    if (numero_identidade) {
                        await persistNumeroIdentidade(newId, numero_identidade);
                    }
                    return res.status(201).json({ id: newId, mensagem: "Utente adicionado com sucesso", fhirId });
                } else {
                    if (numero_identidade) {
                        await persistNumeroIdentidade(newId, numero_identidade);
                    }
                    return res.status(201).json({ id: newId, mensagem: "Utente adicionado com sucesso (FHIR sem id retornado)", fhirResponse: fhirRes });
                }
            } catch (ferr) {
                console.error('FHIR create failed for utente', newId, ferr);
                if (numero_identidade) {
                    await persistNumeroIdentidade(newId, numero_identidade);
                }
                return res.status(201).json({ id: newId, mensagem: "Utente adicionado com sucesso (FHIR falhou)", fhirError: String(ferr) });
            }
        });
        })().catch((err) => res.status(500).json({ error: String(err) }));
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
        const utenteId = utente_id || Number(req.params.id);
        if (!utenteId || Number.isNaN(Number(utenteId))) {
            return res.status(400).json({ error: 'ID do utente inválido ou ausente.' });
        }

        // Processamento pelo Motor CARAT
        const resultado = caratEngine.computeCaratFromAnswers(answers);

        const queryAval = `
            INSERT INTO avaliacoes_carat (utente_id, respostas, score_total, interpretacao, conclusao) 
            VALUES (?, ?, ?, ?, ?)
        `;

        db.run(queryAval, [
            utenteId,
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
                db.run(queryAlerta, [utenteId, avaliacaoId, 'Controlo Insuficiente', 'Alta']);
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

    // Eliminar utente e todos os registos dependentes (sintomas, terapeutica, temperaturas_manuais, observacoes_fhir, avaliacoes, alertas)
    deleteUtente: async (req, res) => {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: 'ID do utente é obrigatório' });

        try {
            // Wrap in a transaction for consistency
            await dbRun('BEGIN TRANSACTION');

            await dbRun('DELETE FROM sintomas WHERE utente_id = ?', [id]);
            await dbRun('DELETE FROM terapeutica WHERE utente_id = ?', [id]);
            await dbRun('DELETE FROM temperaturas_manuais WHERE utente_id = ?', [id]);
            await dbRun('DELETE FROM observacoes_fhir WHERE utente_id = ?', [id]);
            await dbRun('DELETE FROM avaliacoes_carat WHERE utente_id = ?', [id]);
            await dbRun('DELETE FROM alertas WHERE utente_id = ?', [id]);
            await dbRun('DELETE FROM utentes WHERE id = ?', [id]);

            await dbRun('COMMIT');
            return res.json({ message: 'Utente e dados relacionados eliminados com sucesso.' });
        } catch (err) {
            try { await dbRun('ROLLBACK'); } catch (e) { /* ignore */ }
            console.error('Erro ao eliminar utente:', err);
            return res.status(500).json({ error: String(err) });
        }
    },

    // Listar as avaliações CARAT para alimentar a tabela do Dashboard
    getAvaliacoes: (req, res) => {
        db.all("SELECT * FROM avaliacoes_carat ORDER BY datetime(data) DESC, id DESC", [], (err, rows) => {
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
    },

    // Registar temperatura manual na ficha individual do utente
    addTemperatura: async (req, res) => {
        try {
            const { id } = req.params;
            const temperaturaNumero = Number(req.body?.temperatura);
            const dataEfetiva = req.body?.data_efetiva ? String(req.body.data_efetiva) : new Date().toISOString();

            if (!id) {
                return res.status(400).json({ error: 'ID do utente é obrigatório' });
            }

            if (Number.isNaN(temperaturaNumero)) {
                return res.status(400).json({ error: 'Temperatura inválida' });
            }

            if (temperaturaNumero < 30 || temperaturaNumero > 45) {
                return res.status(400).json({ error: 'Temperatura fora do intervalo esperado (30ºC a 45ºC)' });
            }

            const result = await dbRun(
                `INSERT INTO temperaturas_manuais
                 (utente_id, valor, unidade, data_efetiva)
                 VALUES (?, ?, ?, ?)`,
                [id, temperaturaNumero, 'ºC', dataEfetiva]
            );

            return res.status(201).json({
                id: (result as any).lastID,
                mensagem: 'Temperatura registada com sucesso'
            });
        } catch (err) {
            console.error('Erro ao registar temperatura:', err);
            return res.status(500).json({ error: String(err) });
        }
    },

    // Listar temperaturas registadas manualmente na ficha do utente
    getTemperaturas: async (req, res) => {
        try {
            const { id } = req.params;
            const rows = await dbAll(
                `SELECT id, utente_id, valor, unidade, data_efetiva, data_registo
                 FROM temperaturas_manuais
                 WHERE utente_id = ?
                 ORDER BY data_efetiva DESC, id DESC
                 LIMIT 30`,
                [id]
            );

            return res.status(200).json(rows || []);
        } catch (err) {
            console.error('Erro ao obter temperaturas manuais:', err);
            return res.status(500).json({ error: String(err) });
        }
    },

    // Sincronizar observações FHIR para um patient específico
    syncObservacoesFhir: async (req, res) => {
        try {
            const { id } = req.params; // id local do utente

            // Obter patient local
            const utente = await new Promise<any>((resolve, reject) => {
                db.get('SELECT id, fhir_id FROM utentes WHERE id = ?', [id], (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                });
            });

            if (!utente || !utente.fhir_id) {
                return res.status(404).json({ error: 'Utente não tem FHIR ID associado' });
            }

            console.log(`[Obs Sync] Sincronizando observações do patient FHIR: ${utente.fhir_id}`);

            // Buscar observações do FHIR para este patient
            const url = `https://fhir.hl7.pt/r5/fhir/Observation?subject=Patient/${utente.fhir_id}&_count=100`;
            const resposta = await _fetch ? await _fetch(url) : await fetch(url);
            
            if (!resposta.ok) {
                console.log(`[Obs Sync] Erro ao buscar observações: ${resposta.status}`);
                return res.status(500).json({ error: `Erro FHIR: ${resposta.status}` });
            }

            const bundle = await resposta.json();
            const entries = bundle.entry || [];
            
            console.log(`[Obs Sync] Encontradas ${entries.length} observações`);

            let sincronizadas = 0;
            let duplicadas = 0;

            for (const entry of entries) {
                const obs = entry.resource;
                if (obs.resourceType !== 'Observation') continue;

                try {
                    const obsId = obs.id;
                    const codigo = obs.code?.coding?.[0]?.code || 'unknown';
                    const display = obs.code?.coding?.[0]?.display || 'Sem nome';
                    const valor = obs.valueQuantity?.value ?? obs.value?.Quantity?.value ?? obs.valueString ?? obs.valueCodeableConcept?.text ?? obs.valueCodeableConcept?.coding?.[0]?.display ?? obs.value?.CodeableConcept?.coding?.[0]?.display ?? '';
                    const unidade = obs.valueQuantity?.unit || obs.valueQuantity?.code || obs.value?.Quantity?.unit || '';
                    const dataEfetiva = obs.effectiveDateTime || new Date().toISOString();
                    const status = obs.status || 'final';

                    // Tipo de observação (temperatura, medicamento, etc.)
                    const tipo = codigo === '8310-5' ? 'temperatura' : 
                                 codigo === '2516-8' ? 'pressao_sistolica' :
                                 codigo === '2517-6' ? 'pressao_diastolica' :
                                 codigo.includes('drug') || display.toLowerCase().includes('medicamento') ? 'medicamento' : 'outro';

                    // Inserir ou ignorar se já existe
                    const result = await new Promise<any>((resolve) => {
                        db.run(
                            `INSERT INTO observacoes_fhir 
                             (utente_id, fhir_observation_id, codigo, display, valor, unidade, data_efetiva, status, tipo)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [utente.id, obsId, codigo, display, valor, unidade, dataEfetiva, status, tipo],
                            function(err) {
                                if (err && err.message.includes('UNIQUE')) {
                                    db.run(
                                        `UPDATE observacoes_fhir
                                         SET codigo = ?, display = ?, valor = ?, unidade = ?, data_efetiva = ?, status = ?, tipo = ?, data_sincronizacao = CURRENT_TIMESTAMP
                                         WHERE fhir_observation_id = ?`,
                                        [codigo, display, valor, unidade, dataEfetiva, status, tipo, obsId],
                                        function(updateErr) {
                                            if (updateErr) {
                                                resolve({ erro: true, msg: updateErr.message });
                                            } else {
                                                resolve({ duplicada: true, atualizada: true });
                                            }
                                        }
                                    );
                                } else if (err) {
                                    resolve({ erro: true, msg: err.message });
                                } else {
                                    resolve({ sucesso: true });
                                }
                            }
                        );
                    });

                    if (result.atualizada) {
                        sincronizadas++;
                        console.log(`[Obs Sync] ♻️ ${display} atualizada (${valor} ${unidade})`);
                    } else if (result.duplicada) {
                        duplicadas++;
                    } else if (result.sucesso) {
                        sincronizadas++;
                        console.log(`[Obs Sync] ✅ ${display} (${valor} ${unidade})`);
                    }
                } catch (err) {
                    console.error(`[Obs Sync] Erro ao processar observação:`, err);
                }
            }

            return res.status(200).json({
                total: entries.length,
                sincronizadas,
                duplicadas,
                mensagem: `${sincronizadas} observações sincronizadas, ${duplicadas} duplicadas`
            });
        } catch (err) {
            console.error(`[Obs Sync] Erro geral:`, err);
            return res.status(500).json({ error: String(err) });
        }
    },

    // Listar observações de um patient
    getObservacoesFhir: async (req, res) => {
        try {
            const { id } = req.params;

                        const observacoes = await new Promise<any[]>((resolve, reject) => {
                db.all(
                                        `SELECT * FROM observacoes_fhir
                                         WHERE utente_id = ?
                                             AND (fhir_observation_id IS NULL OR fhir_observation_id NOT LIKE 'manual-temp-%')
                                         ORDER BY data_efetiva DESC
                                         LIMIT 50`,
                    [id],
                    (err, rows) => {
                        if (err) return reject(err);
                        resolve(rows || []);
                    }
                );
            });

            return res.status(200).json(observacoes);
        } catch (err) {
            console.error(`[Obs Get] Erro:`, err);
            return res.status(500).json({ error: String(err) });
        }
    },

    // Webhook para receber observações via POST do GraphBuilder/Postman
    receberObservacaoFhir: async (req, res) => {
        try {
            const { fhir_id, codigo, display, valor, unidade, data_efetiva, tipo } = req.body;

            if (!fhir_id) {
                return res.status(400).json({ error: 'fhir_id é obrigatório' });
            }

            console.log(`[Obs Webhook] Recebida observação para patient: ${fhir_id}`);

            // Encontrar utente pelo fhir_id
            const utente = await new Promise<any>((resolve, reject) => {
                db.get('SELECT id FROM utentes WHERE fhir_id = ?', [fhir_id], (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                });
            });

            if (!utente) {
                return res.status(404).json({ error: 'Patient não encontrado na BD local' });
            }

            // Gerar ID único para a observação
            const obsId = `obs-${fhir_id}-${Date.now()}`;

            // Inserir observação
            const result = await new Promise<any>((resolve, reject) => {
                db.run(
                    `INSERT INTO observacoes_fhir 
                     (utente_id, fhir_observation_id, codigo, display, valor, unidade, data_efetiva, tipo)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [utente.id, obsId, codigo || 'unknown', display || 'Observação', valor || '', unidade || '', data_efetiva || new Date().toISOString(), tipo || 'outro'],
                    function(err) {
                        if (err) return reject(err);
                        resolve({ id: this.lastID });
                    }
                );
            });

            console.log(`[Obs Webhook] ✅ ${display} (${valor} ${unidade}) gravada para utente ID ${utente.id}`);

            return res.status(201).json({
                id: result.id,
                mensagem: 'Observação recebida e gravada com sucesso'
            });
        } catch (err) {
            console.error(`[Obs Webhook] Erro:`, err);
            return res.status(500).json({ error: String(err) });
        }
    },

    // ==========================================
    // 🏥 CRUD de MÉDICOS
    // ==========================================
    
    getAllMedicos: async (req, res) => {
        try {
            await ensureMedicosColumns();

            db.all("SELECT * FROM medicos ORDER BY nome", [], (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                const normalized = (rows || []).map((row: any) => ({
                    ...row,
                    telefone: row.telefone || '-',
                    status: row.status || 'Ativo'
                }));
                res.json(normalized);
            });
        } catch (err) {
            return res.status(500).json({ error: String(err) });
        }
    },

    addMedico: async (req, res) => {
        const { nome, email, telefone, especialidade } = req.body;
        
        if (!nome) return res.status(400).json({ error: "Nome é obrigatório." });

        try {
            await ensureMedicosColumns();

            db.run("INSERT INTO medicos (nome, email, telefone, especialidade, status) VALUES (?, ?, ?, ?, ?)",
                [nome, email || '', telefone || '', especialidade || '', 'Ativo'], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                
                const newId = this.lastID;
                res.status(201).json({ 
                    id: newId, 
                    nome, 
                    email: email || '', 
                    telefone: telefone || '',
                    especialidade: especialidade || '',
                    status: 'Ativo',
                    mensagem: "Médico adicionado com sucesso" 
                });
            });
        } catch (err) {
            return res.status(500).json({ error: String(err) });
        }
    },

    updateMedico: async (req, res) => {
        const { id } = req.params;
        const { nome, email, telefone, especialidade } = req.body;
        
        if (!nome) return res.status(400).json({ error: "Nome é obrigatório." });

        try {
            await ensureMedicosColumns();

            db.run("UPDATE medicos SET nome = ?, email = ?, telefone = ?, especialidade = ? WHERE id = ?",
                [nome, email || '', telefone || '', especialidade || '', id], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                
                if (this.changes === 0) {
                    return res.status(404).json({ error: "Médico não encontrado." });
                }
                
                res.json({ id, nome, email: email || '', telefone: telefone || '', especialidade: especialidade || '', status: 'Ativo', mensagem: "Médico atualizado com sucesso" });
            });
        } catch (err) {
            return res.status(500).json({ error: String(err) });
        }
    },

    deleteMedico: (req, res) => {
        const { id } = req.params;
        
        db.run("DELETE FROM medicos WHERE id = ?", [id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            if (this.changes === 0) {
                return res.status(404).json({ error: "Médico não encontrado." });
            }
            
            res.json({ mensagem: "Médico eliminado com sucesso" });
        });
    }
};

module.exports = clinicaController;

export {};