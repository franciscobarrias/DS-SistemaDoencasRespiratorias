const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Definir o caminho para o ficheiro da base de dados na raiz do projeto
const dbPath = path.resolve(__dirname, 'clinica.db');

// Ligar à base de dados (cria o ficheiro se não existir)
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro ao ligar à base de dados:', err.message);
        process.exit(1);
    }
    console.log('✅ Ligação estabelecida com clinica.db');
});

// Ler os ficheiros SQL
// Nota: Certifica-te que o schema.sql e seed.sql estão na mesma pasta que este script
const schemaSQL = fs.readFileSync(path.resolve(__dirname, 'schema.sql'), 'utf8');
const seedSQL = fs.readFileSync(path.resolve(__dirname, 'seed.sql'), 'utf8');

console.log('⏳ A preparar a reconstrução da base de dados...');

db.serialize(() => {
    // 1. Executar o Schema (Criar Tabelas)
    db.exec(schemaSQL, (err) => {
        if (err) {
            console.error('❌ Erro a criar as tabelas (schema.sql):', err.message);
            return;
        }
        console.log('✅ Estrutura de tabelas criada com sucesso.');

        // 2. Executar o Seed (Inserir Dados Iniciais)
        db.exec(seedSQL, (err) => {
            if (err) {
                console.error('❌ Erro a inserir dados iniciais (seed.sql):', err.message);
            } else {
                console.log('✅ Dados de teste inseridos com sucesso.');
                console.log('🚀 Tudo pronto! Podes agora iniciar o servidor com "npm start".');
            }
        });
    });
});

// Fechar a ligação após terminar
db.close((err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('🔌 Ligação à base de dados fechada.');
});