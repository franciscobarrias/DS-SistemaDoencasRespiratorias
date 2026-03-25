-- Ativar o suporte a Foreign Keys no SQLite
PRAGMA foreign_keys = ON;

-- 1. Tabela Admin
CREATE TABLE Admin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
);

-- 2. Tabela Médico
CREATE TABLE Medico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    especialidade TEXT,
    telefone TEXT,
    admin_id INTEGER,
    FOREIGN KEY (admin_id) REFERENCES Admin(id)
);

-- 3. Tabela Utente
CREATE TABLE Utente (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    telefone TEXT,
    data_nascimento DATE,
    medico_id INTEGER,
    admin_id INTEGER,
    FOREIGN KEY (medico_id) REFERENCES Medico(id), ----makes sense?
    FOREIGN KEY (admin_id) REFERENCES Admin(id)
);

-- 4. Tabela Avaliação CARAT
CREATE TABLE AvaliacaoCARAT (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data DATETIME DEFAULT CURRENT_TIMESTAMP,
    respostas TEXT NOT NULL, -- Pode ser guardado como uma string JSON
    score_total INTEGER NOT NULL,
    interpretacao TEXT NOT NULL,
    utente_id INTEGER NOT NULL,
    FOREIGN KEY (utente_id) REFERENCES Utente(id) ON DELETE CASCADE
);

-- 5. Tabela Alerta
CREATE TABLE Alerta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,
    prioridade TEXT NOT NULL,
    estado TEXT DEFAULT 'NOVO', -- Os estados sugeridos são: NOVO, VISTO, EM SEGUIMENTO, FECHADO [cite: 81, 82]
    motivo TEXT NOT NULL,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    medico_id INTEGER NOT NULL,
    utente_id INTEGER NOT NULL,
    avaliacao_id INTEGER,
    FOREIGN KEY (medico_id) REFERENCES Medico(id),
    FOREIGN KEY (utente_id) REFERENCES Utente(id) ON DELETE CASCADE,
    FOREIGN KEY (avaliacao_id) REFERENCES AvaliacaoCARAT(id) ON DELETE CASCADE
);

-- 6. Tabela Medicação
CREATE TABLE Medicacao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    dose TEXT NOT NULL,
    periodo TEXT NOT NULL,
    utente_id INTEGER NOT NULL,
    FOREIGN KEY (utente_id) REFERENCES Utente(id) ON DELETE CASCADE
);

-- 7. Tabela Sintoma 
CREATE TABLE Sintoma (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_registo DATE DEFAULT CURRENT_TIMESTAMP,
    descricao TEXT NOT NULL,
    severidade TEXT NOT NULL,
    utente_id INTEGER NOT NULL,
    FOREIGN KEY (utente_id) REFERENCES Utente(id) ON DELETE CASCADE
);

-- 8. Tabela Exame
CREATE TABLE Exame (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,
    data_realizacao DATE NOT NULL,
    resultado TEXT NOT NULL,
    utente_id INTEGER NOT NULL,
    FOREIGN KEY (utente_id) REFERENCES Utente(id) ON DELETE CASCADE
);