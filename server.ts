require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const clinicaRoutes = require('./routes/clinicaRoutes'); 
const clinicaController = require('./controllers/clinicaController');
const fhirRoutes = require('./routes/fhir.routes'); 
const authRoutes = require('./routes/authRoutes');
const { ensureAuthenticated } = require('./middleware/auth.middleware');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessões simples em memória (suficiente para ambiente de desenvolvimento)
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// ========================================================
// 🛡️ O NOSSO BYPASS: ROTAS DIRETAS
// ========================================================
app.post('/utentes', clinicaController.addUtente); 
app.post('/sintomas', clinicaController.addSintoma);
app.get('/sintomas', clinicaController.getAllSintomas); 
app.get('/sintomas/:utente_id', clinicaController.getSintomas);

// 🛡️ A ROTA QUE FALTAVA: Liga o botão 🗑️ à base de dados!
app.delete('/sintomas/:id', clinicaController.deleteSintoma);
// ========================================================

// Rotas de autenticação (login/logout) sem protecção
app.use('/', authRoutes);

// A partir daqui, proteger tudo com sessão
app.use(ensureAuthenticated);

// Servir ficheiros estáticos apenas após autenticação (página principal protegida)
app.use(express.static(path.join(__dirname)));

app.use('/', clinicaRoutes);
app.use('/fhir', fhirRoutes);

app.listen(PORT, () => {
    console.log(`🚀 Servidor a correr na porta http://localhost:${PORT}`);
});

export {};