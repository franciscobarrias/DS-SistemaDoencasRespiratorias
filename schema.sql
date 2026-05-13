-- Limpeza inicial para reconstrução
DROP TABLE IF EXISTS alertas;
DROP TABLE IF EXISTS avaliacoes_carat;
DROP TABLE IF EXISTS sintomas;
DROP TABLE IF EXISTS utentes;
DROP TABLE IF EXISTS medicos;

-- Tabela de Médicos
CREATE TABLE medicos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    especialidade TEXT,
    email TEXT UNIQUE
);

-- Tabela de Utentes (Com a coluna telefone corrigida)
CREATE TABLE utentes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE,
    telefone TEXT,
    medico_id INTEGER,
    FOREIGN KEY (medico_id) REFERENCES medicos (id)
);

-- Tabela de Avaliações (Onde guardamos o histórico clínico)
CREATE TABLE avaliacoes_carat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    utente_id INTEGER NOT NULL,
    data DATETIME DEFAULT CURRENT_TIMESTAMP,
    respostas TEXT NOT NULL, 
    score_total INTEGER NOT NULL,
    interpretacao TEXT,
    conclusao TEXT,
    FOREIGN KEY (utente_id) REFERENCES utentes (id) ON DELETE CASCADE
);

-- Tabela de Alertas (Entidade separada conforme o teu Modelo ER)
CREATE TABLE alertas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    utente_id INTEGER NOT NULL,
    avaliacao_id INTEGER,
    tipo TEXT NOT NULL,
    prioridade TEXT NOT NULL,
    estado TEXT DEFAULT 'NOVO', -- NOVO ou FECHADO
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utente_id) REFERENCES utentes (id) ON DELETE CASCADE,
    FOREIGN KEY (avaliacao_id) REFERENCES avaliacoes_carat (id) ON DELETE CASCADE
);

-- Tabela de Sintomas (Para o teu gráfico de donuts)
CREATE TABLE sintomas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    utente_id INTEGER NOT NULL,
    descricao TEXT NOT NULL,
    severidade TEXT NOT NULL,
    data_registo DATE DEFAULT CURRENT_DATE,
    FOREIGN KEY (utente_id) REFERENCES utentes (id) ON DELETE CASCADE
);