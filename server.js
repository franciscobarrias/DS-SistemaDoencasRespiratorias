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
        console.log('Base de dados inserida com sucesso.');
    }
});

// === ROTAS DA API ===

// Rota Principal (Raiz)
app.get('/', (req, res) => {
    res.json({ message: 'SaudINOB API pronta' });
});

// Rota: Médicos
app.get('/medicos', (req, res) => {
    db.all('SELECT * FROM Medico', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ medicos: rows });
    });
});

// Rota: Sintomas
app.get('/sintomas', (req, res) => {
    db.all('SELECT * FROM Sintoma', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ sintomas: rows });
    });
});

// Rota: Utentes (A que estava a dar erro!)
app.get('/utentes', (req, res) => {
    db.all('SELECT * FROM Utente', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ utentes: rows });
    });
});

// Rota: Avaliações CARAT (A que estava a dar erro!)
app.get('/avaliacoes', (req, res) => {
    db.all('SELECT * FROM AvaliacaoCARAT', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ avaliacoes: rows });
    });
});

// Rota: Submeter nova Avaliação CARAT
app.post('/avaliacoes', (req, res) => {
    const { utente_id, respostas } = req.body;
    
    // O teu ficheiro carat.js processa as respostas
    const score_total = computeCaratFromAnswers(respostas);
    const interpretacao = recommendationsFromInterpretation(score_total);

    const sql = 'INSERT INTO AvaliacaoCARAT (utente_id, score_total, interpretacao) VALUES (?, ?, ?)';
    db.run(sql, [utente_id, score_total, interpretacao], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ 
            mensagem: 'Avaliação submetida com sucesso.',
            id_avaliacao: this.lastID, 
            score_total: score_total, 
            interpretacao: interpretacao 
        });
    });
});


// Ligar o Servidor
app.listen(PORT, () => {
    console.log(`Servidor a correr na porta http://localhost:${PORT}`);
});