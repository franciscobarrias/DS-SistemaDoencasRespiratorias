-- 1. Limpeza (Drop) das tabelas antigas para garantir uma reconstrução limpa
DROP TABLE IF EXISTS sintomas;
DROP TABLE IF EXISTS avaliacoes;
DROP TABLE IF EXISTS utentes;
DROP TABLE IF EXISTS medicos;

-- 2. Tabela de Utentes (Os teus doentes)
CREATE TABLE utentes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE,
    telefone TEXT
);

-- 3. Tabela de Médicos (Opcional, mas útil se tiveres a aba de médicos)
CREATE TABLE medicos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    especialidade TEXT,
    email TEXT UNIQUE,
    telefone TEXT
);

-- 4. Tabela de Sintomas
CREATE TABLE sintomas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    utente_id INTEGER NOT NULL,
    descricao TEXT NOT NULL,
    severidade TEXT NOT NULL,
    -- A Foreign Key garante que não podes registar um sintoma para um utente que não existe!
    FOREIGN KEY (utente_id) REFERENCES utentes (id) ON DELETE CASCADE
);

-- 5. Tabela de Avaliações CARAT (Com a nova coluna "estado" para os alertas!)
CREATE TABLE avaliacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    utente_id INTEGER NOT NULL,
    score_total INTEGER NOT NULL,
    interpretacao TEXT,
    data TEXT NOT NULL,
    estado TEXT DEFAULT 'NOVO', -- O segredo para o botão "Resolver" funcionar!
    FOREIGN KEY (utente_id) REFERENCES utentes (id) ON DELETE CASCADE
);