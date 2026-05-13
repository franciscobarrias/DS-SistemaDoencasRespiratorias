require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const clinicaRoutes = require('./routes/clinicaRoutes'); 
const clinicaController = require('./controllers/clinicaController'); // Trazemos o controlador diretamente para aqui

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ========================================================
// BYPASS DE EMERGÊNCIA: Forçar a rota diretamente no cérebro
// ========================================================
app.post('/sintomas', clinicaController.addSintoma);
app.get('/sintomas/1', clinicaController.getSintomas); // Rota de teste para garantir que lê
// ========================================================

app.use('/', clinicaRoutes);

app.listen(PORT, () => {
    console.log(`🚀 NOVO Servidor SaudINOB a correr na porta http://localhost:${PORT}`);
});