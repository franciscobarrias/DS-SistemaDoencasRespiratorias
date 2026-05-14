require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const clinicaRoutes = require('./routes/clinicaRoutes'); 
const clinicaController = require('./controllers/clinicaController'); 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ========================================================
// 🛡️ O NOSSO BYPASS CORRIGIDO:
// Trocámos o "1" fixo pela variável ":utente_id".
// Agora o servidor já não procura por utentes "undefined"!
// ========================================================
app.post('/sintomas', clinicaController.addSintoma);
app.get('/sintomas/:utente_id', clinicaController.getSintomas);
// ========================================================

app.use('/', clinicaRoutes);

app.listen(PORT, () => {
    console.log(`🚀 Servidor SaudINOB a correr na porta http://localhost:${PORT}`);
});