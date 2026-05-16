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
// 🛡️ O NOSSO BYPASS: ROTAS DIRETAS
// ========================================================
app.post('/utentes', clinicaController.addUtente); // 🛡️ A ROTA QUE FALTAVA PARA GRAVAR UTENTES!
app.post('/sintomas', clinicaController.addSintoma);
app.get('/sintomas', clinicaController.getAllSintomas); 
app.get('/sintomas/:utente_id', clinicaController.getSintomas);
// ========================================================

app.use('/', clinicaRoutes);

app.listen(PORT, () => {
    console.log(`🚀 Servidor a correr na porta http://localhost:${PORT}`);
});