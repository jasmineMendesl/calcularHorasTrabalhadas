# Integracao com Google Planilhas

Este projeto usa a planilha como um banco de dados simples por meio de um Google Apps Script.

## Como configurar

1. Crie uma planilha no Google Planilhas.
2. Abra `Extensoes > Apps Script`.
3. Cole o conteudo de `google-apps-script.js` no editor do Apps Script.
4. Copie o ID da planilha pela URL do Google Sheets.
5. Cole esse ID em `SPREADSHEET_ID` no Apps Script.
6. Salve o projeto.
7. Clique em `Implantar > Nova implantacao`.
8. Escolha o tipo `App da Web`.
9. Em `Executar como`, escolha voce mesmo.
10. Em `Quem pode acessar`, escolha uma opcao compativel com seu uso.
11. Clique em `Implantar` e copie a URL do App da Web.
12. No arquivo `script.js`, cole a URL em `SPREADSHEET_API_URL`.

O ID da planilha fica nesta parte da URL:

```text
https://docs.google.com/spreadsheets/d/ID_DA_PLANILHA/edit
```

Exemplo no Apps Script:

```js
const SPREADSHEET_ID = 'ID_DA_PLANILHA';
```

Antes de publicar, selecione a funcao `testConnection` no Apps Script, clique em executar e aceite as permissoes. Se estiver tudo certo, ela retorna uma mensagem de conexao com a aba `Horas admooh`.

Exemplo:

```js
const SPREADSHEET_API_URL = 'https://script.google.com/macros/s/SEU_ID/exec';
```

Com a URL configurada, os lancamentos passam a ser salvos na aba `Horas admooh` da planilha. A aba usa as colunas `id`, `date`, `hours`, `person`, `description` e `jiraLink`. Se a planilha ficar indisponivel, o app continua mostrando os dados salvos no navegador.

## Se aparecer `Failed to fetch`

Use a versao atual do arquivo `google-apps-script.js`, salve no Apps Script e atualize a implantacao do App da Web. O app usa JSONP para evitar bloqueios de CORS do navegador.

Ao alterar o Apps Script, clique em `Implantar > Gerenciar implantacoes > Editar` e selecione uma nova versao antes de testar novamente.
