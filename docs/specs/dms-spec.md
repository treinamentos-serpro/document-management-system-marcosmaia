# Especificação - Document Management System

**Status:** especificação do MVP

**Escopo deste documento:** definir o comportamento esperado. A implementação das camadas de backend e da interface frontend fica para etapas futuras.

## 1. Objetivo

Disponibilizar uma aplicação web simples para que um usuário envie, liste e baixe seus documentos, mantendo os arquivos no filesystem local da aplicação e os metadados em memória.

## 2. Escopo

### Dentro do escopo

- Upload de um arquivo por requisição.
- Associação de cada documento ao identificador de seu proprietário.
- Listagem dos documentos do proprietário informado.
- Download de um documento pelo identificador, somente quando associado ao proprietário informado.
- Gravação dos arquivos em `backend/storage`, usando Multer com `diskStorage`.
- Armazenamento em memória dos metadados durante a execução do processo.
- Interface React para upload, listagem e download, consumindo a API por `fetch`.

### Fora do escopo

- Armazenamento em nuvem, em serviços externos ou em banco de dados.
- Persistência dos metadados após reinício do backend.
- Autenticação ou autorização real de usuários.
- Versionamento, edição, exclusão ou compartilhamento de documentos.
- Whitelist de tipos MIME, antivírus ou inspeção do conteúdo dos arquivos.
- Garantia de durabilidade, replicação ou alta disponibilidade do armazenamento local.

## 3. Requisitos funcionais

| ID | Requisito | Critério de aceite |
| --- | --- | --- |
| RF-01 | O usuário pode enviar um documento. | Um arquivo enviado com um `X-User-ID` válido é armazenado e a API responde com seus metadados e status `201`. |
| RF-02 | O sistema valida a entrada do upload. | Requisição sem proprietário, sem arquivo, com arquivo vazio ou acima do limite é rejeitada com o status especificado nos contratos. |
| RF-03 | O sistema gera um identificador único e metadados para cada documento. | O registro contém ID, nome original, tamanho, MIME informado, data/hora de upload e proprietário. |
| RF-04 | O usuário pode listar seus documentos. | A resposta contém somente documentos associados ao `X-User-ID` informado, ordenados do mais recente para o mais antigo. |
| RF-05 | A listagem vazia é válida. | Se o usuário não tiver documentos, a API responde `200` com `[]`. |
| RF-06 | O usuário pode baixar um documento pelo ID. | O backend entrega o conteúdo binário como anexo somente se o registro pertencer ao `X-User-ID` informado e o arquivo existir. |
| RF-07 | O sistema informa falhas sem expor detalhes internos. | Erros HTTP usam o formato JSON definido nesta especificação; erros inesperados não expõem caminhos locais, stack traces ou detalhes do filesystem. |
| RF-08 | A interface permite operar o fluxo básico. | O usuário pode selecionar e enviar um arquivo, visualizar a lista, iniciar um download e receber feedback de carregamento ou erro. |

## 4. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Os arquivos são gravados exclusivamente no filesystem local, sob `backend/storage`, com Multer `diskStorage`. Não usar provedores de armazenamento externos. |
| RNF-02 | Os metadados ficam em memória no processo do backend; reiniciar o processo os remove. |
| RNF-03 | O limite padrão de upload é 100 MiB (104857600 bytes) e deve ser configurável por variável de ambiente. |
| RNF-04 | O backend usa Node.js, Express e CommonJS; o frontend usa React, Vite e ESM; o código permanece em JavaScript. |
| RNF-05 | O backend respeita a Clean Architecture simples: `routes -> controllers -> services -> repositories`. Camadas internas não dependem do Express nem conhecem detalhes HTTP. |
| RNF-06 | O frontend comunica-se com o backend via HTTP e `fetch`, usando o prefixo `/api` no navegador e o proxy de desenvolvimento do Vite. |
| RNF-07 | O nome original do arquivo não é usado para construir o caminho de armazenamento. O arquivo recebe nome interno gerado pelo sistema. |
| RNF-08 | Todas as rotas que leem ou criam documentos exigem `X-User-ID`. Esse header é somente um identificador fornecido pelo cliente, não uma prova de identidade. O mecanismo não deve ser considerado controle de acesso seguro para produção. |

## 5. Modelo de dados

### 5.1 Metadados públicos do documento

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `id` | string (UUID) | Sim | Identificador único gerado pelo sistema. |
| `originalName` | string | Sim | Nome original informado pelo cliente; usado para exibição e como nome sugerido no download, nunca como caminho local. |
| `size` | number | Sim | Tamanho do arquivo em bytes. Arquivos vazios não são aceitos. |
| `mimeType` | string | Sim | Tipo MIME informado no upload. É metadado informativo e não valida o conteúdo do arquivo. |
| `uploadedAt` | string (ISO 8601 UTC) | Sim | Instante em que o documento foi aceito, por exemplo `2026-10-26T14:30:45.123Z`. |
| `owner` | string | Sim | Valor de `X-User-ID` associado ao documento. |

### 5.2 Dados internos de armazenamento

O repositório mantém, além dos metadados públicos, a referência ao nome interno gerado para o arquivo. Essa referência não é retornada ao cliente. O caminho absoluto ou relativo do arquivo é derivado da configuração local de armazenamento e não é exposto pela API.

Os metadados são mantidos em memória. Após reiniciar o processo, os arquivos podem continuar em `backend/storage`, mas não haverá registros para localizá-los pela API; esses arquivos são considerados órfãos nesta fase.

## 6. Contratos de API

### 6.1 Convenções

- Os caminhos do backend são montados sem prefixo `/api`: `/upload`, `/documents` e `/documents/:id/download`.
- No desenvolvimento, o frontend chama `/api/upload`, `/api/documents` e `/api/documents/:id/download`. A configuração atual do Vite encaminha `/api` para o backend e remove esse prefixo antes do encaminhamento.
- `X-User-ID` é obrigatório em todas as operações de documentos. Deve ser uma string não vazia após remoção de espaços nas extremidades. A API não autentica esse valor.
- Respostas de erro são JSON no formato `{ "error": "CODIGO", "message": "Descrição em português" }`.
- Salvo indicação de resposta binária, respostas bem-sucedidas são JSON em UTF-8.
- Os exemplos de host/porta são para desenvolvimento local; a configuração do host deve permanecer fora do código.

### 6.2 `POST /upload`

**Finalidade:** armazenar um documento e associá-lo ao proprietário.

**Requisição:**

- Header obrigatório: `X-User-ID: <identificador>`.
- `Content-Type: multipart/form-data`.
- Campo de formulário obrigatório: `file`, contendo um único arquivo.
- Limite padrão: 100 MiB por arquivo, configurável por `MAX_FILE_SIZE` em bytes.
- O MVP aceita qualquer MIME informado pelo cliente; não faz detecção ou validação do conteúdo real.

**Sucesso - `201 Created`:** retorna o objeto de metadados públicos criado.

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "originalName": "relatorio.pdf",
  "size": 204800,
  "mimeType": "application/pdf",
  "uploadedAt": "2026-10-26T14:30:45.123Z",
  "owner": "user-123"
}
```

**Erros:**

| Status | Código | Condição |
| --- | --- | --- |
| `400` | `OWNER_REQUIRED` | Header `X-User-ID` ausente ou vazio. |
| `400` | `FILE_REQUIRED` | Campo `file` ausente ou nenhum arquivo recebido. |
| `400` | `FILE_EMPTY` | Arquivo recebido com tamanho zero. |
| `413` | `FILE_TOO_LARGE` | Arquivo excede `MAX_FILE_SIZE`. |
| `500` | `UPLOAD_FAILED` | Falha inesperada ao gravar o arquivo ou registrar metadados. |

### 6.3 `GET /documents`

**Finalidade:** listar os documentos do proprietário.

**Requisição:** header obrigatório `X-User-ID: <identificador>`.

**Sucesso - `200 OK`:** retorna um array de metadados públicos, ordenado por `uploadedAt` descendente. Sem documentos, retorna `[]`.

**Erros:**

| Status | Código | Condição |
| --- | --- | --- |
| `400` | `OWNER_REQUIRED` | Header `X-User-ID` ausente ou vazio. |
| `500` | `DOCUMENT_LIST_FAILED` | Falha inesperada ao consultar os metadados em memória. |

### 6.4 `GET /documents/:id/download`

**Finalidade:** baixar o arquivo associado ao ID informado.

**Requisição:**

- Parâmetro de caminho `id`: UUID do documento.
- Header obrigatório `X-User-ID: <identificador>`.

**Sucesso - `200 OK`:** corpo binário do arquivo, com `Content-Type` baseado no MIME registrado (ou `application/octet-stream` quando indisponível) e `Content-Disposition: attachment` com o nome original tratado com segurança como nome de download. Não incluir caminhos locais na resposta.

**Erros:**

| Status | Código | Condição |
| --- | --- | --- |
| `400` | `OWNER_REQUIRED` | Header `X-User-ID` ausente ou vazio. |
| `404` | `DOCUMENT_NOT_FOUND` | ID inexistente, documento associado a outro proprietário ou arquivo local indisponível. A resposta não deve revelar se o ID existe para outro proprietário. |
| `500` | `DOWNLOAD_FAILED` | Falha inesperada de leitura que não corresponda a arquivo indisponível. |

### 6.5 `GET /health`

Endpoint já presente no seed para verificação de disponibilidade; não faz parte das operações de documentos.

**Sucesso - `200 OK`:**

```json
{ "status": "ok" }
```

## 7. Decisões arquiteturais

### Backend

Fluxo de dependência: `routes -> controllers -> services -> repositories`.

| Camada | Responsabilidade prevista |
| --- | --- |
| `routes/` | Declarar os endpoints e associar o middleware de upload à rota apropriada. |
| `controllers/` | Adaptar entrada/saída HTTP, validar requisitos básicos da requisição e traduzir resultados para respostas HTTP. |
| `services/` | Aplicar regras de negócio: associação ao proprietário, geração/coordenação de metadados e autorização por proprietário dentro das limitações do MVP. |
| `repositories/` | Persistir metadados em memória e acessar os arquivos locais; manter detalhes do filesystem fora das camadas HTTP. |

Multer com `diskStorage` é o mecanismo de recebimento e gravação local de arquivos. A configuração deve usar diretório local configurável ou o padrão `backend/storage`, criar/preparar o diretório necessário e gerar nomes internos que não dependam de `originalName`. Nenhuma camada deve enviar arquivos para provedores externos.

### Frontend

O frontend React apresenta o fluxo principal de upload, lista os metadados retornados pela API e permite baixar cada documento. Um serviço em `frontend/src/services/` centraliza as chamadas `fetch`. A tela deve contemplar estados de carregamento, sucesso, lista vazia e falha, sem duplicar lógica de rede nos componentes.

### Configuração

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP do backend. |
| `NODE_ENV` | definido pelo ambiente | Contexto de execução. |
| `MAX_FILE_SIZE` | `104857600` | Tamanho máximo do arquivo em bytes (100 MiB). |
| `STORAGE_PATH` | `backend/storage` | Diretório local para os arquivos, resolvido de forma consistente independentemente do diretório de inicialização. |

## 8. Plano de execução

As etapas abaixo são trabalho futuro descrito pela especificação. Esta entrega cria somente este documento; não implementa nem altera arquivos de backend ou frontend.

| Etapa | Entrega futura | Dependência |
| --- | --- | --- |
| 1 | Definir e validar configuração de ambiente e inicialização do diretório local de storage, mantendo `multer.diskStorage`. | Esta especificação. |
| 2 | Implementar o repositório para salvar/ler arquivos locais e manter metadados em memória, com consulta por ID e proprietário. | Etapa 1. |
| 3 | Implementar o serviço com regras de upload, metadados, listagem por proprietário e autorização de download por proprietário. | Etapa 2. |
| 4 | Implementar controllers e rotas, incluindo parsing multipart com Multer e mapeamento consistente de erros HTTP. | Etapa 3. |
| 5 | Integrar as rotas na aplicação Express e manter o endpoint `/health`. | Etapa 4. |
| 6 | Adicionar testes backend para validações, persistência local, isolamento por proprietário, respostas e erros da API. | Etapa 5. |
| 7 | Implementar o serviço frontend com `fetch` e integração com os caminhos `/api` encaminhados pelo proxy Vite. | Contratos backend disponíveis. |
| 8 | Implementar a interface React para envio, listagem e download, incluindo estados de carregamento, vazio e erro. | Etapa 7. |
| 9 | Validar o fluxo integrado e os limites/erros de upload; documentar limitações conhecidas do armazenamento em memória. | Etapas 6 e 8. |

## 9. Riscos e limitações conhecidas

- `X-User-ID` é controlável pelo cliente e não substitui autenticação. Qualquer pessoa capaz de chamar a API pode declarar outro identificador; não tratar esse mecanismo como seguro para dados sensíveis ou exposição pública.
- Metadados em memória são perdidos ao reiniciar o backend, enquanto os arquivos locais podem permanecer órfãos.
- O armazenamento em disco local depende da disponibilidade e capacidade do host; não há replicação ou recuperação automatizada.
- A aceitação de qualquer MIME type não garante que o conteúdo corresponda ao tipo declarado. O sistema deve tratar arquivos como conteúdo não confiável.
- O nome original precisa ser tratado ao compor `Content-Disposition` para evitar cabeçalhos inválidos ou injeção; nunca deve determinar o caminho local.

## 10. Critérios de conclusão do MVP

- Os três endpoints de documento atendem aos contratos deste documento e usam `X-User-ID` consistentemente.
- Uploads são limitados por configuração, gravados localmente por Multer `diskStorage` com nome interno gerado, e seus metadados ficam em memória.
- Listagem e download não retornam documentos associados a outro identificador de proprietário.
- A interface permite enviar, listar e baixar documentos e apresenta falhas sem travar o fluxo.
- Testes backend cobrem os fluxos de sucesso e as principais respostas de erro.
- Nenhum armazenamento externo ou persistência de metadados fora da memória foi introduzido no MVP.