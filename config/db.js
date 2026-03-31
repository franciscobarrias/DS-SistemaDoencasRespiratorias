const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 1. Definir o caminho da base de dados (usando o .env ou o fallback)
const dbPath = process.env.DB_PATH || path.join(__dirname, '../clinica.db');

// 2. Criar a ligação
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro na ligação à base de dados:', err.message);
    } else {
        console.log('✅ Base de dados ligada com sucesso.');
        
        // Ativar o suporte a chaves estrangeiras em cada ligação (Essencial!)
        db.run("PRAGMA foreign_keys = ON;");
    }
});

module.exports = db;