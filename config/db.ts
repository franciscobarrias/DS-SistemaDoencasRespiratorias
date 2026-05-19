const sqlite3 = require('sqlite3').verbose();

// 1. Caminho exato da base de dados (Igual ao do setup.js)
const dbPath = process.env.DB_PATH || './clinica.db';

// 2. Estabelecer a ligação
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro na ligação à base de dados:', err.message);
    } else {
        console.log('✅ Base de dados ligada com sucesso (clinica.db).');
        
        // 3. ATIVAR FOREIGN KEYS (Crítico para a base de dados!)
        // O SQLite desativa as chaves estrangeiras por padrão. Temos de forçar a ativação.
        db.run("PRAGMA foreign_keys = ON;", (err) => {
            if (err) {
                console.error('⚠️ Erro ao ativar chaves estrangeiras:', err.message);
            } else {
                console.log('🛡️ Suporte a chaves estrangeiras ativado.');
                
                // 🛡️ NOVIDADE: Inicialização automática da tabela de terapêutica
                db.run(`CREATE TABLE IF NOT EXISTS terapeutica (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    utente_id INTEGER,
                    medicamento TEXT NOT NULL,
                    posologia TEXT,
                    data_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(utente_id) REFERENCES utentes(id)
                )`, (errTable) => {
                    if (errTable) {
                        console.error('❌ Erro ao criar a tabela terapeutica:', errTable.message);
                    } else {
                        console.log('📦 Tabela "terapeutica" verificada/criada com sucesso.');
                    }
                });
            }
        });
    }
});

// 4. Exportar a ligação para o resto do projeto (Controllers, etc.)
module.exports = db;

export {};