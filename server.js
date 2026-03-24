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

// Rota para ir buscar todos os Médicos
app.get('/medicos', (req, res) => {
    const sql = 'SELECT * FROM Medico';
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ erro: err.message });
            return;
        }
        res.json({ medicos: rows });
    });
});

// Rota para ir buscar todos os Sintomas
app.get('/sintomas', (req, res) => {
    const sql = 'SELECT * FROM Sintoma';
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ erro: err.message });
            return;
        }
        res.json({ sintomas: rows });
    });
});

// Ligar o Servidor
app.listen(porta, () => {
    console.log(`🚀 Servidor a correr na porta http://localhost:${porta}`);
});