const sqlite3 = require('sqlite3').verbose();

// Agora ele vai buscar o caminho da base de dados ao cofre!
const dbPath = process.env.DB_PATH || './clinica.db'; // Adicionado fallback por segurança

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro na base de dados:', err.message);
    } else {
        console.log('Base de dados ligada com sucesso.');
        
        // 1. Tabela de Sintomas
        db.run(`CREATE TABLE IF NOT EXISTS Sintoma (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            utente_id INTEGER,
            descricao TEXT,
            severidade TEXT,
            data_registo TEXT
        )`);

        // 2. NOVA TABELA: Alertas (Baseada no teu Modelo ER!)
        db.run(`CREATE TABLE IF NOT EXISTS Alerta (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT,
            prioridade TEXT,
            estado TEXT,
            motivo TEXT,
            data_criacao TEXT,
            utente_id INTEGER,
            medico_id INTEGER,
            avaliacao_id INTEGER
        )`);

        // 3. Atualização da tabela de Avaliações
        db.run("ALTER TABLE AvaliacaoCARAT ADD COLUMN data_preenchimento TEXT", (err) => {
            // Se a coluna já existir, ignora o erro silenciosamente
        });
    }
});

module.exports = db;