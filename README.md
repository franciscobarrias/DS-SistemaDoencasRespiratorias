# SaudINOB

SaudINOB é uma aplicação web para monitorização respiratória clínica com foco em registo de utentes, avaliações CARAT, sintomas, terapêutica, alertas e integração com um servidor FHIR. O projeto combina frontend em HTML/CSS/JavaScript com backend em Node.js/Express e persistência local em SQLite.

## Descrição do Projeto

O sistema organiza o trabalho em três perfis principais: administrador, médico e doente. O administrador gere médicos e doentes, consulta listagens e exporta relatórios em CSV. O médico acompanha alertas, histórico CARAT, sintomas, terapêutica, temperaturas manuais e observações FHIR. O doente acede ao portal, responde ao questionário CARAT e regista sintomas.

A aplicação está estruturada para funcionar com:

- páginas HTML estáticas servidas a partir da raiz do projeto
- backend Express com sessões
- base de dados SQLite local
- integração com um servidor FHIR R5
- validação de payloads com AJV e JSON Schema

## Funcionalidades

### Administrador

- autenticação via página de login com seleção de perfil
- acesso ao painel administrativo com estatísticas gerais
- listagem de médicos
- criação de médicos
- edição de médicos
- eliminação de médicos
- listagem de doentes
- criação de doentes
- eliminação de doentes
- sincronização global de doentes com o servidor FHIR
- exportação de relatórios de médicos, doentes e atividades em CSV

Observação: a interface de edição de doentes existe no frontend, mas o backend não expõe uma rota `PUT /utentes/:id`; por isso essa atualização está apenas parcialmente implementada.

### Médico

- dashboard clínico com KPIs de utentes e alertas
- listagem de alertas clínicos ativos
- resolução de alertas
- visualização da lista global de utentes
- pesquisa de utentes
- abertura da ficha clínica individual
- visualização do histórico CARAT em lista e gráfico
- registo de terapêutica local por utente
- registo de temperaturas manuais por utente
- listagem de temperaturas manuais na ficha clínica
- visualização de observações FHIR sincronizadas
- sincronização de observações FHIR por utente
- sincronização global de observações FHIR no dashboard
- listagem e eliminação de sintomas
- criação de novos utentes a partir do painel clínico
- exportação dos resultados CARAT para CSV
- sincronização global de utentes com o FHIR

### Doente

- acesso ao portal do doente após login
- resposta ao questionário CARAT
- registo simples de sintomas
- visualização de avaliações recentes
- consulta de perfil básico com nome, email e telefone
- alternância de tema claro/escuro

## Integração FHIR

A integração FHIR está centrada no servidor base `https://fhir.hl7.pt/r5/fhir`, com possibilidade de sobrescrever o endereço via variável de ambiente.

### Sincronização de pacientes

- criação de `Patient` quando um utente local é criado
- importação de um `Patient` específico para a base local
- sincronização global de `Patient` do servidor FHIR para a base local
- sincronização de utentes locais antigos sem `fhir_id` para o servidor FHIR

### Observações

- leitura de recursos `Observation` via rota FHIR dedicada
- sincronização de observações de um `Patient` para a tabela local `observacoes_fhir`
- receção de observações por webhook para integração externa
- mapeamento de observações para tipos como `temperatura`, `medicamento`, `pressao_sistolica`, `pressao_diastolica` e `outro`

### Medicações e temperaturas

- a terapêutica é guardada localmente na tabela `terapeutica`
- as temperaturas manuais são guardadas localmente na tabela `temperaturas_manuais`
- observações de medicação e temperatura podem aparecer como `Observation` no FHIR quando codificadas no recurso recebido

### Recursos FHIR utilizados

- `Patient`
- `Observation`

Não existem, no código atual, operações dedicadas de escrita para recursos como `MedicationRequest`, `Encounter` ou `Condition`.

## Tecnologias Utilizadas

- Node.js
- Express
- TypeScript
- SQLite3
- express-session
- cors
- dotenv
- AJV
- express-validator
- node-fetch como fallback de rede
- Chart.js no frontend
- Google Fonts (`Poppins`)

## Estrutura do Projeto

```text
.
├── admin.html
├── app.js
├── app.ts
├── carat.ts
├── config/
│   └── db.ts
├── controllers/
│   └── clinicaController.ts
├── dtos/
│   └── fhir/
│       └── observation.dto.ts
├── index.html
├── login.html
├── medico.html
├── middleware/
│   ├── auth.middleware.ts
│   └── jsonValidator.ts
├── mappers/
│   └── fhir-observation.mapper.ts
├── paciente.html
├── package.json
├── questionario.html
├── README.md
├── routes/
│   ├── authRoutes.ts
│   ├── clinicaRoutes.ts
│   └── fhir.routes.ts
├── schemas/
│   ├── alert-patch.schema.json
│   ├── carat-request.schema.json
│   └── sintoma-request.schema.json
├── schema.sql
├── seed.sql
├── server.js
├── server.ts
├── services/
│   ├── fhir.service.ts
│   └── fhir.services.ts
├── setup.ts
├── style.css
└── test/
	└── carat.test.ts
```

Notas sobre a estrutura atual:

- não existe pasta `public/`
- não existe pasta `views/`
- não existe pasta `database/`
- o ficheiro `clinica.db` é gerado localmente
- existem ficheiros `.js` na raiz que funcionam como cópias/artefactos legados dos ficheiros TypeScript

## Instalação

```bash
npm install
npm run build
npm start
```

Para reconstruir a base de dados de raiz com o schema e dados de seed:

```bash
npm run setup
```

## Configuração

Variáveis de ambiente suportadas pelo código atual:

- `PORT` - porta do servidor Express, por defeito `3000`
- `DB_PATH` - caminho para a base de dados SQLite, por defeito `./clinica.db`
- `SESSION_SECRET` - segredo da sessão Express, por defeito `dev-secret` em ambiente de desenvolvimento
- `ADMIN_USER` - utilizador aceito no login, por defeito `admin`
- `ADMIN_PASS` - palavra-passe aceita no login, por defeito `admin`
- `FHIR_SERVER` - endpoint base FHIR, por defeito `https://fhir.hl7.pt/r5/fhir`
- `FHIR_TOKEN` - token Bearer opcional para o servidor FHIR

O login atual não utiliza contas separadas por perfil. O nome de utilizador e a palavra-passe são validados contra as variáveis `ADMIN_USER` e `ADMIN_PASS`, e o tipo de utilizador é escolhido na própria página de login.

## API Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/` | Redireciona para login ou para o dashboard conforme a sessão |
| POST | `/login.html` | Autentica a sessão e define o tipo de utilizador |
| POST | `/logout` | Termina a sessão |
| GET | `/utentes` | Lista todos os utentes |
| POST | `/utentes` | Cria um utente local e tenta criar o respetivo `Patient` no FHIR |
| POST | `/utentes/sync/fhir` | Sincroniza utentes locais sem `fhir_id` para o FHIR |
| POST | `/utentes/sync/fhir-all` | Importa todos os `Patient` do servidor FHIR para a base local |
| POST | `/utentes/import-fhir/:fhirId` | Importa um `Patient` específico do FHIR para a base local |
| GET | `/utentes/:id/history` | Devolve o histórico CARAT de um utente |
| GET | `/utentes/:id/terapeutica` | Lista a terapêutica local de um utente |
| POST | `/utentes/:id/terapeutica` | Adiciona um medicamento à terapêutica local |
| POST | `/utentes/:id/temperatura` | Regista uma temperatura manual local |
| GET | `/utentes/:id/temperaturas` | Lista temperaturas manuais de um utente |
| GET | `/utentes/:id/observacoes-fhir` | Lista observações FHIR sincronizadas localmente |
| POST | `/utentes/:id/sincronizar-observacoes-fhir` | Sincroniza observações FHIR de um utente |
| POST | `/fhir/webhook/observacao` | Recebe observações FHIR por webhook |
| GET | `/carat-resultados` | Lista todas as avaliações CARAT |
| POST | `/utentes/:id/carat` | Submete uma avaliação CARAT e pode gerar alerta |
| GET | `/medico/alertas` | Lista alertas clínicos ativos |
| PUT | `/medico/alertas/:id/resolver` | Marca um alerta como resolvido |
| GET | `/sintomas` | Lista todos os sintomas |
| GET | `/sintomas/:utente_id` | Lista sintomas de um utente específico |
| POST | `/sintomas` | Cria um sintoma |
| DELETE | `/sintomas/:id` | Elimina um sintoma |
| DELETE | `/utentes/:id` | Elimina um utente e os respetivos registos relacionados |
| GET | `/medicos` | Lista médicos |
| POST | `/medicos` | Cria médico |
| PUT | `/medicos/:id` | Atualiza médico |
| DELETE | `/medicos/:id` | Elimina médico |
| GET | `/fhir/observations` | Consulta observações do servidor FHIR |
| GET | `/fhir/patients/:id` | Consulta um `Patient` no servidor FHIR |

Nota: no `server.ts` existem também rotas diretas registadas antes do middleware de autenticação. Isso significa que parte do CRUD está acessível sem proteção de sessão, apesar de as páginas estáticas serem protegidas depois do login.

## Fluxos da Aplicação

### Registo de doente

1. O administrador cria um doente no painel administrativo.
2. O backend grava o utente em SQLite.
3. O serviço FHIR tenta criar o correspondente `Patient`.
4. Se a criação FHIR falhar, o registo local continua válido e a resposta assinala o erro FHIR.

### Registo de sintomas

1. O doente seleciona sintomas no portal do doente ou o médico regista sintomas no painel clínico.
2. O frontend envia `utente_id`, `descricao` e `severidade`.
3. O backend valida o payload com JSON Schema.
4. O sintoma é gravado na tabela `sintomas`.

### Avaliação CARAT

1. O doente responde às 10 perguntas do questionário.
2. O frontend envia as respostas para `/utentes/:id/carat`.
3. O motor `carat.ts` soma o score e devolve a interpretação.
4. A avaliação é gravada em `avaliacoes_carat`.
5. Se o score for inferior a 24, é criado um alerta clínico.

### Sincronização FHIR

1. O médico ou administrador pede sincronização global ou por utente.
2. O backend consulta o servidor FHIR.
3. Os `Patient` ou `Observation` relevantes são importados para as tabelas locais.
4. A aplicação passa a mostrar o estado FHIR na ficha do utente.

### Observações FHIR

1. O frontend solicita observações globais ou por utente.
2. O backend lê `Observation` do servidor FHIR ou a cópia local em `observacoes_fhir`.
3. O mapper converte o recurso para o formato usado pelo dashboard.
4. A interface apresenta o tipo, valor, unidade e data.

## Base de Dados

O projeto usa SQLite com o ficheiro local `clinica.db`.

### Tabelas principais

- `medicos` - médicos registados na aplicação
- `utentes` - doentes, com referência opcional ao médico responsável e ao `fhir_id`
- `avaliacoes_carat` - histórico de respostas, score e interpretação CARAT
- `alertas` - alertas gerados a partir de avaliações clínicas
- `sintomas` - sintomas reportados manualmente
- `observacoes_fhir` - cache local de observações FHIR sincronizadas
- `terapeutica` - medicamentos e posologias associados a um utente
- `temperaturas_manuais` - medições de temperatura inseridas manualmente

### Relações

- `utentes.medico_id` referencia `medicos.id`
- `avaliacoes_carat.utente_id` referencia `utentes.id` com `ON DELETE CASCADE`
- `alertas.utente_id` referencia `utentes.id` com `ON DELETE CASCADE`
- `alertas.avaliacao_id` referencia `avaliacoes_carat.id` com `ON DELETE CASCADE`
- `sintomas.utente_id` referencia `utentes.id` com `ON DELETE CASCADE`
- `observacoes_fhir.utente_id` referencia `utentes.id` com `ON DELETE CASCADE`
- `terapeutica.utente_id` referencia `utentes.id`
- `temperaturas_manuais.utente_id` referencia `utentes.id` com `ON DELETE CASCADE`

### Observações sobre o schema

- `schema.sql` define a estrutura base da base de dados
- `seed.sql` insere médico, utentes, avaliação CARAT, alerta e sintomas de teste
- `setup.ts` recria a base de dados a partir desses ficheiros
- `config/db.ts` cria dinamicamente tabelas adicionais se estiverem em falta, como `terapeutica` e `temperaturas_manuais`

## Segurança

O sistema usa `express-session` para manter sessões de login.

### O que está implementado

- login com `ADMIN_USER` e `ADMIN_PASS`
- sessão marcada com `authenticated` e `userType`
- redirecionamento consoante o perfil do utilizador
- proteção das páginas estáticas após autenticação

### Limitações reais encontradas no código

- o middleware de role-based access existe, mas não está aplicado às rotas
- o middleware `ensureRole` verifica `req.session.role`, mas o login grava `req.session.userType`
- várias rotas CRUD são registadas antes da proteção por sessão em `server.ts`
- não existe gestão de utilizadores com credenciais individuais por médico/doente
- a segurança está adequada para desenvolvimento, mas não para uso clínico real sem reforço



## Melhorias Futuras

- implementar `PUT /utentes/:id` para fechar o ciclo de edição de doentes no backend
- alinhar autenticação com perfis reais e permissões por utilizador
- mover as páginas HTML para uma estrutura `public/` ou `views/` coerente com o deploy
- transformar o frontend em bundle único gerado por build, evitando duplicação entre `app.ts` e `app.js`
- expor relatórios no backend em vez de depender apenas de exportação no frontend
- adicionar testes para rotas clínicas e FHIR, além do teste atual do motor CARAT
- rever o script `test:postman`, porque o `package.json` aponta para caminhos `postman/...` que não existem no estado atual do repositório
- expandir a integração FHIR para escrita de outros recursos, se for clinicamente necessário

## Estado dos Scripts

Os scripts definidos no `package.json` são:

- `npm run setup` - recria a base de dados com `schema.sql` e `seed.sql`
- `npm start` - executa `server.ts` com `ts-node`
- `npm run build` - compila TypeScript com `tsc`
- `npm test` - executa o teste do motor CARAT
- `npm run test:postman` - depende de `newman` e de ficheiros que não estão no caminho referenciado atualmente


