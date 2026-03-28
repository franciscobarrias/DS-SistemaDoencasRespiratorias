# 🏥 Clínica SaudINOB - Sistema de Doenças Respiratórias

Bem-vindo ao repositório do sistema de gestão da **Clínica SaudINOB**, uma aplicação web *Full-Stack* desenvolvida para a monitorização e gestão de doentes com patologias respiratórias (Asma e Rinite Alérgica).

Este projeto integra uma API robusta, uma base de dados relacional e uma interface de utilizador interativa e moderna.

---

## ✨ Funcionalidades Principais

* **📊 Dashboard Clínico:** Uma interface centralizada (Frontend) para visualização rápida de dados cruciais.
* **📋 Gestão de Utentes e Equipa Médica:** Consulta em tempo real dos doentes registados e dos profissionais de saúde da clínica.
* **🩺 Questionário CARAT:** Formulário digital para avaliação do Controlo da Asma e Rinite Alérgica (*Control of Allergic Rhinitis and Asthma Test*), com cálculo automático de *score* e interpretação clínica.
* **🤒 Registo de Sintomas (CRUD):** * Leitura dos sintomas associados aos utentes.
  * Adição de novos sintomas com indicação de severidade (Ligação à Base de Dados via método `POST`).
  * Remoção de sintomas obsoletos ou inseridos por engano (via método `DELETE`).

---

## 💻 Tecnologias Utilizadas

**Frontend:**
* HTML5 & CSS3 (Design responsivo e interface *user-friendly*)
* JavaScript (Vanilla JS para chamadas à API via `fetch`)

**Backend:**
* [Node.js](https://nodejs.org/) (Ambiente de execução)
* [Express.js](https://expressjs.com/) (Criação do servidor e rotas da API)
* [SQLite3](https://www.sqlite.org/) (Base de dados leve e relacional)
* [CORS](https://expressjs.com/en/resources/middleware/cors.html) (Middleware para permitir comunicação entre Frontend e Backend)

---

## 🚀 Como Instalar e Correr o Projeto

Para testar este projeto localmente, siga os seguintes passos:

**1. Clonar o repositório e instalar dependências**
Abra o terminal e execute:
\`\`\`bash
git clone https://github.com/franciscobarrias/DS-SistemaDoencasRespiratorias.git
cd DS-SistemaDoencasRespiratorias
npm install
\`\`\`

**2. Ligar o Servidor (Backend)**
No mesmo terminal, inicie a API e a ligação à base de dados SQLite:
\`\`\`bash
node server.js
\`\`\`
*(A API ficará a correr em `http://localhost:3000` e a base de dados `clinica.db` será iniciada)*

**3. Abrir a Aplicação (Frontend)**
Com o servidor a correr, pode interagir com o sistema através do browser:
* **Dashboard Principal:** Abra o ficheiro `index.html` usando a extensão *Live Server* do VS Code (ou abra diretamente no browser).
* **Questionário Clínico:** Navegue para `questionario.html` para preencher o inquérito CARAT.

---

## 🛣️ Endpoints da API

A nossa API RESTful disponibiliza as seguintes rotas:

* \`GET /\` - Confirmação do estado do servidor.
* \`GET /utentes\` - Retorna a lista de doentes.
* \`GET /medicos\` - Retorna a equipa médica.
* \`GET /sintomas\` - Retorna todos os sintomas.
* \`POST /sintomas\` - Adiciona um novo sintoma associado a um utente.
* \`DELETE /sintomas/:id\` - Remove um sintoma da base de dados.
* \`GET /avaliacoes\` - Retorna o histórico de questionários CARAT.
* \`POST /avaliacoes\` - Submete um novo questionário, calculando e guardando o *score* final e a data.

---
*Projeto desenvolvido no âmbito da Unidade Curricular de Desenvolvimento de Software.*