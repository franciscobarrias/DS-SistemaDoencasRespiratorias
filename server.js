require('dotenv').config(); // Ligar o cofre de variáveis de ambiente
const express = require('express');
const cors = require('cors');
const path = require('path');
const clinicaRoutes = require('./routes/clinicaRoutes'); // Importar o "mapa" de rotas

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Diz ao servidor para usar as rotas que definimos na pasta "routes"
app.use('/', clinicaRoutes);

// Ligar o Servidor
app.listen(PORT, () => {
    console.log(`Servidor a correr na porta http://localhost:${PORT}`);
});