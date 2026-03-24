const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

// Inicializar a aplicação Express
const app = express();
const porta = 3000;

// Configurar os "Middlewares" (ajudantes da API)
app.use(cors()); // Permite que o Frontend comunique com o Backend
app.use(express.json()); // Permite que a API perceba dados enviados em formato JSON

// Criar/Ligar à Base de Dados SQLite
// Isto vai criar um ficheiro "clinica.db" na tua pasta automaticamente
const db = new sqlite3.Database('./clinica.db', (err) => {
    if (err) {
        console.error('Erro ao ligar à base de dados:', err.message);
    } else {
        console.log('Ligado à base de dados SQLite com sucesso!');
    }
});

// O teu primeiro Endpoint de Teste!
app.get('/', (req, res) => {
    res.json({ mensagem: 'Bem-vindo à API do Sistema SaudINOB!' });
});

// Rota para ir buscar todos os Utentes à base de dados
app.get('/utentes', (req, res) => {
    const sql = 'SELECT * FROM Utente';
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ erro: err.message });
            return;
        }
        // Envia os dados encontrados para o browser em formato JSON
        res.json({ utentes: rows });
    });
});

// Rota para ir buscar todas as Avaliações CARAT
app.get('/avaliacoes', (req, res) => {
    const sql = 'SELECT * FROM AvaliacaoCARAT';
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ erro: err.message });
            return;
        }
        res.json({ avaliacoes: rows });
    });
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