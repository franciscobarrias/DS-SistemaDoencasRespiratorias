# DS-SistemaDoencasRespiratorias

API Node.js + Express + SQLite para prevencao e acompanhamento de doencas respiratorias,
com modulo CARAT, alertas e perfis (Admin, Medico, Utente).

## Requisitos

- Node.js 18+
- npm

## Setup

1. Instalar dependencias:

```bash
npm install
```

2. Criar estrutura e dados simulados:

```bash
npm run setup
```

3. Arrancar a API:

```bash
npm start
```

Servidor por omissao em http://localhost:3000.

## Testes

```bash
npm test
```

## Autenticacao (simples por token)

Endpoint de login:

```http
POST /auth/login
Content-Type: application/json

{
	"role": "admin",
	"email": "admin@saudinob.pt",
	"password": "admin123"
}
```

Usar token no header:

```http
Authorization: Bearer <token>
```

## Endpoints minimos implementados

### Patients CRUD

- GET /patients
- POST /patients
- GET /patients/:id
- PATCH /patients/:id
- DELETE /patients/:id

### Doctors CRUD

- GET /doctors
- POST /doctors
- GET /doctors/:id
- PATCH /doctors/:id
- DELETE /doctors/:id

### CARAT

- POST /patients/:id/carat
- GET /patients/:id/carat
- GET /carat/:evalId

### Alerts

- GET /doctors/:id/alerts
- GET /patients/:id/alerts
- PATCH /alerts/:id

## Contratos

Pasta contracts com schemas JSON:

- contracts/carat-request.schema.json
- contracts/alert-patch.schema.json

## Notas

- Alertas sao gerados automaticamente ao registar CARAT com regras de:
	- score abaixo de limiar
	- deterioracao vs avaliacao anterior
	- sintomas persistentes recentes
	- indicacao de avaliacao/exames
- O projeto usa dados simulados em clinica.db.