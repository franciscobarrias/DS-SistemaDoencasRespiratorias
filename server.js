const express = require('express');
const cors = require('cors');
const clinicaRoutes = require('./routes/clinicaRoutes'); // Importa as rotas!

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Diz ao servidor para usar as rotas que definimos
app.use('/', clinicaRoutes);

app.listen(PORT, () => {
    console.log(`Servidor a correr na porta http://localhost:${PORT}`);
});