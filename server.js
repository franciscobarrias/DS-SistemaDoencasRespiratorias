const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const {
    computeCaratFromAnswers,
    recommendationsFromInterpretation,
    nextStepFromInterpretation,
} = require('./carat');

const app = express();
const PORT = process.env.PORT || 3000;
const CARAT_THRESHOLD = 16;
const DETERIORATION_DELTA = 4;

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./clinica.db', (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to SQLite database.');
    }
});

const dbGet = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });

const dbAll = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });

const dbRun = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.run(sql, params, function runCallback(err) {
            if (err) return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });

function pickRoleTable(role) {
    if (role === 'admin') return 'Admin';
    if (role === 'doctor') return 'Medico';
    if (role === 'patient') return 'Utente';
    return null;
}

function tokenEncode(payload) {
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function tokenDecode(token) {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    return JSON.parse(decoded);
}

function authRequired(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header.' });
    }

    try {
        req.user = tokenDecode(auth.slice(7));
        return next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token.' });
    }
}

function requireRoles(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden for this profile.' });
        }
        return next();
    };
}

function validatePatientPayload(body) {
    const required = ['nome', 'email', 'password'];
    for (const key of required) {
        if (!body[key] || typeof body[key] !== 'string') {
            return `${key} is required and must be a string.`;
        }
    }
    return null;
}

function validateDoctorPayload(body) {
    const required = ['nome', 'email', 'password'];
    for (const key of required) {
        if (!body[key] || typeof body[key] !== 'string') {
            return `${key} is required and must be a string.`;
        }
    }
    return null;
}

function validateCaratPayload(body) {
    if (!body || typeof body !== 'object') return 'Body is required.';
    if (!body.answers || typeof body.answers !== 'object') return 'answers object is required.';
    const values = Object.values(body.answers);
    if (!values.length) return 'answers cannot be empty.';

    for (const value of values) {
        if (!Number.isInteger(value) || value < 0 || value > 4) {
            return 'All answers must be integers between 0 and 4.';
        }
    }

    return null;
}

async function createAlert({ type, priority, motivo, medicoId, utenteId, avaliacaoId }) {
    await dbRun(
        `INSERT INTO Alerta (tipo, prioridade, estado, motivo, medico_id, utente_id, avaliacao_id)
         VALUES (?, ?, 'NOVO', ?, ?, ?, ?)`,
        [type, priority, motivo, medicoId, utenteId, avaliacaoId]
    );
}

async function evaluateAndCreateAlerts({ utenteId, medicoId, currentScore, avaliacaoId }) {
    if (currentScore < CARAT_THRESHOLD) {
        await createAlert({
            type: 'CONTROLO_INSUFICIENTE',
            priority: 'ALTA',
            motivo: `CARAT score ${currentScore} abaixo do limiar ${CARAT_THRESHOLD}.`,
            medicoId,
            utenteId,
            avaliacaoId,
        });
    }

    const previous = await dbGet(
        `SELECT score_total FROM AvaliacaoCARAT
         WHERE utente_id = ? AND id <> ?
         ORDER BY data DESC, id DESC
         LIMIT 1`,
        [utenteId, avaliacaoId]
    );

    if (previous && previous.score_total - currentScore >= DETERIORATION_DELTA) {
        await createAlert({
            type: 'DETERIORACAO',
            priority: 'ALTA',
            motivo: `Deterioracao >= ${DETERIORATION_DELTA} pontos face a ultima avaliacao.`,
            medicoId,
            utenteId,
            avaliacaoId,
        });
    }

    const persistentSymptoms = await dbGet(
        `SELECT COUNT(*) AS total FROM Sintoma
         WHERE utente_id = ? AND LOWER(severidade) IN ('grave', 'moderada')
         AND date(data_registo) >= date('now', '-30 days')`,
        [utenteId]
    );

    if (persistentSymptoms && persistentSymptoms.total >= 2) {
        await createAlert({
            type: 'REVISAO_TERAPEUTICA',
            priority: 'MEDIA',
            motivo: 'Sintomas persistentes nas ultimas 4 semanas.',
            medicoId,
            utenteId,
            avaliacaoId,
        });
    }

    if (currentScore < 12) {
        await createAlert({
            type: 'AVALIACAO_EXAMES',
            priority: 'ALTA',
            motivo: 'Score muito baixo, considerar avaliacao/exames.',
            medicoId,
            utenteId,
            avaliacaoId,
        });
    }
}

app.get('/', (_req, res) => {
    res.json({ message: 'SaudINOB API online.' });
});

app.post('/auth/login', async (req, res, next) => {
    try {
        const { role, email, password } = req.body;
        const table = pickRoleTable(role);
        if (!table || !email || !password) {
            return res.status(400).json({ error: 'role, email and password are required.' });
        }

        const user = await dbGet(`SELECT * FROM ${table} WHERE email = ? AND password = ?`, [email, password]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const token = tokenEncode({ role, id: user.id, email: user.email });
        return res.json({ token, profile: { id: user.id, role, nome: user.nome, email: user.email } });
    } catch (error) {
        return next(error);
    }
});

app.get('/patients', authRequired, requireRoles('admin', 'doctor'), async (_req, res, next) => {
    try {
        const rows = await dbAll('SELECT * FROM Utente ORDER BY id DESC');
        res.json({ patients: rows });
    } catch (error) {
        next(error);
    }
});

app.post('/patients', authRequired, requireRoles('admin'), async (req, res, next) => {
    try {
        const err = validatePatientPayload(req.body);
        if (err) return res.status(400).json({ error: err });

        const { nome, email, password, telefone = null, data_nascimento = null, medico_id = null, admin_id = null } = req.body;
        const result = await dbRun(
            `INSERT INTO Utente (nome, email, password, telefone, data_nascimento, medico_id, admin_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [nome, email, password, telefone, data_nascimento, medico_id, admin_id]
        );

        const created = await dbGet('SELECT * FROM Utente WHERE id = ?', [result.lastID]);
        res.status(201).json({ patient: created });
    } catch (error) {
        next(error);
    }
});

app.get('/patients/:id', authRequired, async (req, res, next) => {
    try {
        const patientId = Number(req.params.id);
        if (!Number.isInteger(patientId)) return res.status(400).json({ error: 'Invalid patient id.' });

        if (req.user.role === 'patient' && req.user.id !== patientId) {
            return res.status(403).json({ error: 'Cannot access other patient data.' });
        }
        if (!['admin', 'doctor', 'patient'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden for this profile.' });
        }

        const row = await dbGet('SELECT * FROM Utente WHERE id = ?', [patientId]);
        if (!row) return res.status(404).json({ error: 'Patient not found.' });

        res.json({ patient: row });
    } catch (error) {
        next(error);
    }
});

app.patch('/patients/:id', authRequired, requireRoles('admin'), async (req, res, next) => {
    try {
        const patientId = Number(req.params.id);
        if (!Number.isInteger(patientId)) return res.status(400).json({ error: 'Invalid patient id.' });

        const existing = await dbGet('SELECT * FROM Utente WHERE id = ?', [patientId]);
        if (!existing) return res.status(404).json({ error: 'Patient not found.' });

        const updated = {
            nome: req.body.nome ?? existing.nome,
            email: req.body.email ?? existing.email,
            password: req.body.password ?? existing.password,
            telefone: req.body.telefone ?? existing.telefone,
            data_nascimento: req.body.data_nascimento ?? existing.data_nascimento,
            medico_id: req.body.medico_id ?? existing.medico_id,
            admin_id: req.body.admin_id ?? existing.admin_id,
        };

        await dbRun(
            `UPDATE Utente
             SET nome = ?, email = ?, password = ?, telefone = ?, data_nascimento = ?, medico_id = ?, admin_id = ?
             WHERE id = ?`,
            [
                updated.nome,
                updated.email,
                updated.password,
                updated.telefone,
                updated.data_nascimento,
                updated.medico_id,
                updated.admin_id,
                patientId,
            ]
        );

        const row = await dbGet('SELECT * FROM Utente WHERE id = ?', [patientId]);
        res.json({ patient: row });
    } catch (error) {
        next(error);
    }
});

app.delete('/patients/:id', authRequired, requireRoles('admin'), async (req, res, next) => {
    try {
        const patientId = Number(req.params.id);
        if (!Number.isInteger(patientId)) return res.status(400).json({ error: 'Invalid patient id.' });

        const result = await dbRun('DELETE FROM Utente WHERE id = ?', [patientId]);
        if (!result.changes) return res.status(404).json({ error: 'Patient not found.' });

        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

app.get('/doctors', authRequired, requireRoles('admin', 'doctor'), async (_req, res, next) => {
    try {
        const rows = await dbAll('SELECT * FROM Medico ORDER BY id DESC');
        res.json({ doctors: rows });
    } catch (error) {
        next(error);
    }
});

app.post('/doctors', authRequired, requireRoles('admin'), async (req, res, next) => {
    try {
        const err = validateDoctorPayload(req.body);
        if (err) return res.status(400).json({ error: err });

        const {
            nome,
            email,
            password,
            especialidade = null,
            telefone = null,
            admin_id = null,
        } = req.body;

        const result = await dbRun(
            `INSERT INTO Medico (nome, email, password, especialidade, telefone, admin_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [nome, email, password, especialidade, telefone, admin_id]
        );

        const created = await dbGet('SELECT * FROM Medico WHERE id = ?', [result.lastID]);
        res.status(201).json({ doctor: created });
    } catch (error) {
        next(error);
    }
});

app.get('/doctors/:id', authRequired, requireRoles('admin', 'doctor'), async (req, res, next) => {
    try {
        const doctorId = Number(req.params.id);
        if (!Number.isInteger(doctorId)) return res.status(400).json({ error: 'Invalid doctor id.' });

        if (req.user.role === 'doctor' && req.user.id !== doctorId) {
            return res.status(403).json({ error: 'Cannot access other doctor profile.' });
        }

        const row = await dbGet('SELECT * FROM Medico WHERE id = ?', [doctorId]);
        if (!row) return res.status(404).json({ error: 'Doctor not found.' });

        res.json({ doctor: row });
    } catch (error) {
        next(error);
    }
});

app.patch('/doctors/:id', authRequired, requireRoles('admin'), async (req, res, next) => {
    try {
        const doctorId = Number(req.params.id);
        if (!Number.isInteger(doctorId)) return res.status(400).json({ error: 'Invalid doctor id.' });

        const existing = await dbGet('SELECT * FROM Medico WHERE id = ?', [doctorId]);
        if (!existing) return res.status(404).json({ error: 'Doctor not found.' });

        const updated = {
            nome: req.body.nome ?? existing.nome,
            email: req.body.email ?? existing.email,
            password: req.body.password ?? existing.password,
            especialidade: req.body.especialidade ?? existing.especialidade,
            telefone: req.body.telefone ?? existing.telefone,
            admin_id: req.body.admin_id ?? existing.admin_id,
        };

        await dbRun(
            `UPDATE Medico
             SET nome = ?, email = ?, password = ?, especialidade = ?, telefone = ?, admin_id = ?
             WHERE id = ?`,
            [
                updated.nome,
                updated.email,
                updated.password,
                updated.especialidade,
                updated.telefone,
                updated.admin_id,
                doctorId,
            ]
        );

        const row = await dbGet('SELECT * FROM Medico WHERE id = ?', [doctorId]);
        res.json({ doctor: row });
    } catch (error) {
        next(error);
    }
});

app.delete('/doctors/:id', authRequired, requireRoles('admin'), async (req, res, next) => {
    try {
        const doctorId = Number(req.params.id);
        if (!Number.isInteger(doctorId)) return res.status(400).json({ error: 'Invalid doctor id.' });

        const result = await dbRun('DELETE FROM Medico WHERE id = ?', [doctorId]);
        if (!result.changes) return res.status(404).json({ error: 'Doctor not found.' });

        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

app.post('/patients/:id/carat', authRequired, async (req, res, next) => {
    try {
        const patientId = Number(req.params.id);
        if (!Number.isInteger(patientId)) return res.status(400).json({ error: 'Invalid patient id.' });

        if (req.user.role === 'patient' && req.user.id !== patientId) {
            return res.status(403).json({ error: 'Cannot submit for other patient.' });
        }
        if (!['admin', 'doctor', 'patient'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden for this profile.' });
        }

        const payloadError = validateCaratPayload(req.body);
        if (payloadError) return res.status(400).json({ error: payloadError });

        const patient = await dbGet('SELECT * FROM Utente WHERE id = ?', [patientId]);
        if (!patient) return res.status(404).json({ error: 'Patient not found.' });

        const carat = computeCaratFromAnswers(req.body.answers);
        const recommendations = recommendationsFromInterpretation(carat.interpretation);
        const nextStep = nextStepFromInterpretation(carat.interpretation);

        const result = await dbRun(
            `INSERT INTO AvaliacaoCARAT (respostas, score_total, interpretacao, utente_id)
             VALUES (?, ?, ?, ?)`,
            [JSON.stringify(req.body.answers), carat.totalScore, carat.interpretation, patientId]
        );

        await evaluateAndCreateAlerts({
            utenteId: patientId,
            medicoId: patient.medico_id,
            currentScore: carat.totalScore,
            avaliacaoId: result.lastID,
        });

        const evaluation = await dbGet('SELECT * FROM AvaliacaoCARAT WHERE id = ?', [result.lastID]);
        res.status(201).json({
            evaluation,
            output: {
                score_total: carat.totalScore,
                level: carat.interpretation,
                recommendations,
                next_step: nextStep,
            },
        });
    } catch (error) {
        next(error);
    }
});

app.get('/patients/:id/carat', authRequired, async (req, res, next) => {
    try {
        const patientId = Number(req.params.id);
        if (!Number.isInteger(patientId)) return res.status(400).json({ error: 'Invalid patient id.' });

        if (req.user.role === 'patient' && req.user.id !== patientId) {
            return res.status(403).json({ error: 'Cannot access other patient history.' });
        }
        if (!['admin', 'doctor', 'patient'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden for this profile.' });
        }

        const rows = await dbAll(
            'SELECT * FROM AvaliacaoCARAT WHERE utente_id = ? ORDER BY data DESC, id DESC',
            [patientId]
        );
        res.json({ evaluations: rows });
    } catch (error) {
        next(error);
    }
});

app.get('/carat/:evalId', authRequired, requireRoles('admin', 'doctor', 'patient'), async (req, res, next) => {
    try {
        const evalId = Number(req.params.evalId);
        if (!Number.isInteger(evalId)) return res.status(400).json({ error: 'Invalid evaluation id.' });

        const row = await dbGet('SELECT * FROM AvaliacaoCARAT WHERE id = ?', [evalId]);
        if (!row) return res.status(404).json({ error: 'Evaluation not found.' });

        if (req.user.role === 'patient' && req.user.id !== row.utente_id) {
            return res.status(403).json({ error: 'Cannot access other patient evaluation.' });
        }

        res.json({ evaluation: row });
    } catch (error) {
        next(error);
    }
});

app.get('/doctors/:id/alerts', authRequired, requireRoles('admin', 'doctor'), async (req, res, next) => {
    try {
        const doctorId = Number(req.params.id);
        if (!Number.isInteger(doctorId)) return res.status(400).json({ error: 'Invalid doctor id.' });

        if (req.user.role === 'doctor' && req.user.id !== doctorId) {
            return res.status(403).json({ error: 'Cannot access other doctor alerts.' });
        }

        const rows = await dbAll('SELECT * FROM Alerta WHERE medico_id = ? ORDER BY data_criacao DESC, id DESC', [doctorId]);
        res.json({ alerts: rows });
    } catch (error) {
        next(error);
    }
});

app.get('/patients/:id/alerts', authRequired, async (req, res, next) => {
    try {
        const patientId = Number(req.params.id);
        if (!Number.isInteger(patientId)) return res.status(400).json({ error: 'Invalid patient id.' });

        if (req.user.role === 'patient' && req.user.id !== patientId) {
            return res.status(403).json({ error: 'Cannot access other patient alerts.' });
        }
        if (!['admin', 'doctor', 'patient'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden for this profile.' });
        }

        const rows = await dbAll('SELECT * FROM Alerta WHERE utente_id = ? ORDER BY data_criacao DESC, id DESC', [patientId]);
        res.json({ alerts: rows });
    } catch (error) {
        next(error);
    }
});

app.patch('/alerts/:id', authRequired, requireRoles('admin', 'doctor'), async (req, res, next) => {
    try {
        const alertId = Number(req.params.id);
        if (!Number.isInteger(alertId)) return res.status(400).json({ error: 'Invalid alert id.' });

        const validStates = ['NOVO', 'VISTO', 'EM SEGUIMENTO', 'FECHADO'];
        const validPriorities = ['BAIXA', 'MEDIA', 'ALTA'];
        const { estado, prioridade } = req.body;

        if (!estado && !prioridade) {
            return res.status(400).json({ error: 'Provide estado and/or prioridade.' });
        }
        if (estado && !validStates.includes(estado)) {
            return res.status(400).json({ error: 'Invalid estado.' });
        }
        if (prioridade && !validPriorities.includes(prioridade)) {
            return res.status(400).json({ error: 'Invalid prioridade.' });
        }

        const alert = await dbGet('SELECT * FROM Alerta WHERE id = ?', [alertId]);
        if (!alert) return res.status(404).json({ error: 'Alert not found.' });

        if (req.user.role === 'doctor' && req.user.id !== alert.medico_id) {
            return res.status(403).json({ error: 'Cannot edit alerts from other doctors.' });
        }

        await dbRun('UPDATE Alerta SET estado = ?, prioridade = ? WHERE id = ?', [
            estado ?? alert.estado,
            prioridade ?? alert.prioridade,
            alertId,
        ]);

        const updated = await dbGet('SELECT * FROM Alerta WHERE id = ?', [alertId]);
        res.json({ alert: updated });
    } catch (error) {
        next(error);
    }
});

app.use((err, _req, res, _next) => {
    console.error('[API error]', err.message);
    if (err.message && err.message.includes('SQLITE_CONSTRAINT')) {
        return res.status(409).json({ error: 'Constraint violation.' });
    }
    return res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});