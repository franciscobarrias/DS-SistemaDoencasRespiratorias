const sqlite3 = require('sqlite3').verbose();

// Liga à base de dados que está na pasta raiz
const db = new sqlite3.Database('./clinica.db', (err) => {
    if (err) {
        console.error('Erro na base de dados:', err.message);
    } else {
        console.log('Base de dados ligada com sucesso.');
        
        db.run(`CREATE TABLE IF NOT EXISTS Sintoma (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            utente_id INTEGER,
            descricao TEXT,
            severidade TEXT,
            data_registo TEXT
        )`);

        db.run("ALTER TABLE AvaliacaoCARAT ADD COLUMN data_preenchimento TEXT", (err) => {});
    }
});

// Exportar para os outros ficheiros poderem usar!
module.exports = db;