Instruções rápidas para usar a coleção Postman

1) Importar na aplicação Postman
- Abra Postman → Import → selecione `postman/collection.json`.
- Ative o ambiente importando `postman/environment.json` ou criando variáveis equivalentes.

2) Ajustar `baseUrl`
- Por omissão `baseUrl` aponta para `http://localhost:3000`. Altere se necessário.

3) Executar com Newman (linha de comando)
- Instalar newman globalmente: `npm install -g newman` ou localmente: `npm install --save-dev newman`.
- Executar: `npm run test:postman` (usa `postman/collection.json` e `postman/environment.json`).

Nota: Os testes usam validação incorporada nas scripts da coleção (validação do corpo CARAT). Substituí `tv4` por uma validação local para evitar avisos depreciação. Se preferires, posso embutir `ajv` na coleção (maior compatibilidade com JSON Schema).

4) Dicas
- Defina `utenteId` e `alertaId` no ambiente antes de executar requests que usem essas variáveis.
- Para CI, instale `newman` como dependência dev e execute `npm run test:postman` no pipeline.
