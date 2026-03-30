const sqlite3 = require('sqlite3').verbose();

// Agora ele vai buscar o caminho da base de dados ao cofre!
const dbPath = process.env.DB_PATH;

const db = new sqlite3.Database(dbPath, (err) => {
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

module.exports = db;