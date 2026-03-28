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
        console.error('Erro na base de dados:', err.message);
    } else {
        console.log('Base de dados ligada com sucesso.');
        
        // Cria a tabela de Sintomas se ela não existir
        db.run(`CREATE TABLE IF NOT EXISTS Sintoma (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            utente_id INTEGER,
            descricao TEXT,
            severidade TEXT,
            data_registo TEXT
        )`, (err) => {
            if (err) console.error("Erro ao criar tabela Sintoma:", err.message);
            else console.log("Tabela 'Sintoma' pronta.");
        });

        // Adiciona a coluna data_preenchimento à tabela (ignora erro se já existir)
        db.run("ALTER TABLE AvaliacaoCARAT ADD COLUMN data_preenchimento TEXT", (err) => {
            if (!err) {
                console.log("Coluna 'data_preenchimento' adicionada com sucesso!");
            }
        });
    }
});

// === ROTAS DA API ===

// Rota Principal (Raiz)
app.get('/', (req, res) => {
    res.json({ message: 'SaudINOB API pronta' });
});

// Rota: Médicos (Ler)
app.get('/medicos', (req, res) => {
    db.all('SELECT * FROM Medico', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ medicos: rows });
    });
});

// Rota: Sintomas (Ler)
app.get('/sintomas', (req, res) => {
    db.all('SELECT * FROM Sintoma', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ sintomas: rows });
    });
});

// Rota: Sintomas (Escrever/Gravar)
app.post('/sintomas', (req, res) => {
    const { utente_id, descricao, severidade } = req.body;
    const data_registo = new Date().toISOString();

    const sql = 'INSERT INTO Sintoma (utente_id, descricao, severidade, data_registo) VALUES (?, ?, ?, ?)';
    
    db.run(sql, [utente_id, descricao, severidade, data_registo], function(err) {
        if (err) {
            return res.status(500).json({ erro: err.message });
        }
        res.json({ mensagem: 'Sintoma guardado com sucesso na base de dados!' });
    });
});

// 🗑️ NOVA ROTA: Sintomas (Apagar/DELETE) 🗑️
app.delete('/sintomas/:id', (req, res) => {
    const idSintoma = req.params.id; 
    const sql = 'DELETE FROM Sintoma WHERE id = ?';
    
    db.run(sql, idSintoma, function(err) {
        if (err) {
            return res.status(500).json({ erro: err.message });
        }
        res.json({ mensagem: 'Sintoma apagado com sucesso!' });
    });
});

// Rota: Utentes (Ler)
app.get('/utentes', (req, res) => {
    db.all('SELECT * FROM Utente', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ utentes: rows });
    });
});

// Rota: Ler as Avaliações CARAT
app.get('/avaliacoes', (req, res) => {
    db.all('SELECT * FROM AvaliacaoCARAT', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ avaliacoes: rows });
    });
});

// Rota: Gravar Avaliações CARAT
app.post('/avaliacoes', (req, res) => {
    const { utente_id, respostas } = req.body;
    const respostasSeguras = respostas || [];

    // Gera a data atual no formato ISO 8601 (UTC)
    const data_preenchimento = new Date().toISOString();

    const resultado = computeCaratFromAnswers(respostasSeguras);
    const score_total = resultado.totalScore; 
    const interpretacao = resultado.interpretation || recommendationsFromInterpretation(score_total);

    const respostasStr = JSON.stringify(respostasSeguras);
    
    const sql = 'INSERT INTO AvaliacaoCARAT (utente_id, respostas, score_total, interpretacao, data_preenchimento) VALUES (?, ?, ?, ?, ?)';
    
    db.run(sql, [utente_id, respostasStr, score_total, interpretacao, data_preenchimento], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ 
            mensagem: 'Avaliação submetida com sucesso.',
            id_avaliacao: this.lastID, 
            score_total: score_total, 
            interpretacao: interpretacao,
            data_preenchimento: data_preenchimento
        });
    });
});

// Ligar o Servidor
app.listen(PORT, () => {
    console.log(`Servidor a correr na porta http://localhost:${PORT}`);
});