# Constitution Search MVP

Ferramenta de busca e análise da Constituição Brasileira com resumos gerados por inteligência artificial.

## Funcionalidades

- **Busca Fuzzy**: Pesquisa inteligente em todo texto constitucional usando algoritmos de correspondência aproximada
- **Resumos com IA**: Geração automática de resumos em linguagem simples usando Google Gemini
- **Interface Responsiva**: Aplicação web simples sem frameworks externos
- **Busca Hierárquica**: Indexa artigos, incisos, parágrafos e alíneas de forma unificada

## Instalação

1. **Clone o repositório**
   ```bash
   git clone https://github.com/gabes-machado/constitution-search-mvp.git
   cd constitution-search-mvp
   ```

2. **Instale dependências**
   ```bash
   npm install
   ```

3. **Configure a API do Gemini**
   ```bash
   cp .env.example .env
   ```
   
   Edite o arquivo `.env` e adicione sua chave da API:
   ```
   VITE_GEMINI_API_KEY=sua_chave_aqui
   ```

4. **Obtenha uma chave da API do Gemini**
   - Acesse https://ai.google.dev/
   - Crie uma conta Google Cloud
   - Ative a API do Gemini
   - Gere uma API key

## Execução

**Desenvolvimento**
```bash
npm run dev
```
Aplicação disponível em `http://localhost:5173`

**Build de produção**
```bash
npm run build
```
Arquivos gerados na pasta `dist/`

**Preview do build**
```bash
npm run preview
```

## Como Usar

1. **Buscar**: Digite termos como "direitos fundamentais", "art. 5", ou "liberdade de expressão"
2. **Resumir**: Clique em "Resumir com IA" em qualquer resultado
3. **Visualizar**: O resumo aparece abaixo do botão em linguagem simplificada

## Configuração da Busca

O sistema usa Fuse.js com as seguintes configurações:
- **Threshold**: 0.4 (balanço entre precisão e flexibilidade)
- **Ignore Location**: true (busca em todo o texto)
- **Ignore Diacritics**: true (ignora acentos)
- **Campos indexados**: título do artigo e texto completo

## API do Gemini

**Endpoint usado**: `v1beta/models/gemini-2.0-flash:generateContent`

**Configurações de segurança**: Permissivas para conteúdo jurídico que pode ser incorretamente flagrado

**Prompt template**: "Você é um assistente jurídico especializado na constituição brasileira. Leia o seguinte trecho da constituição e o resuma usando uma linguagem simples"

## Estrutura dos Dados

O arquivo `constitution.json` segue esta hierarquia:
```
titulos/
├── capitulos/
│   ├── secoes/
│   │   └── artigos/
│   │       ├── texto[]
│   │       ├── incisos/
│   │       ├── paragrafos/
│   │       └── alineas/
```

Todos os níveis são processados recursivamente para criar um índice uniforme de busca.

## Tratamento de Erros

- **API Key ausente**: Exibe mensagem de configuração
- **Falha na API**: Mostra detalhes específicos do erro
- **Arquivo constitucional ausente**: Instrui sobre localização correta
- **Problemas de rede**: Diferencia erros de conexão de erros de API

## Performance

- **Busca local**: Índice Fuse.js carregado em memória
- **Cache de resumos**: Evita múltiplas chamadas à API para o mesmo artigo
- **Loading states**: Feedback visual durante processamento
- **Lazy loading**: Resumos gerados apenas quando solicitados

## Limitações

- Requer conexão à internet para funcionalidade de resumos
- Limitado pelas quotas da API do Gemini
- Interface minimalista sem CSS framework
- Dados constitucionais estáticos (não atualizados automaticamente)

## Licença

Unlicense - Software de domínio público. Veja arquivo `LICENSE` para detalhes.

## Desenvolvimento

**Arquitetura**: Single Page Application vanilla
**Padrões**: Event delegation, async/await, módulos ES6
**Bundling**: Vite com configuração mínima
**Deploy**: Arquivos estáticos compatíveis com qualquer servidor web