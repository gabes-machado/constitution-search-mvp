import Fuse from 'fuse.js';
import axios from 'axios';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL_ID = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${GEMINI_API_KEY}`;

const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const resultsContainer = document.getElementById('results-container');
const selectedArticleContainer = document.getElementById('selected-article-container');

let fuse;
let constitutionData = [];

/**
 * Inicializa a aplicação carregando dados constitucionais e configurando busca fuzzy.
 * Utiliza o Vite para servir arquivos estáticos da pasta 'public'.
 * Em caso de falha, exibe mensagem de erro detalhada na interface.
 */
async function initializeApp() {
    try {
        const response = await fetch('/constitution.json');
        
        if (!response.ok) {
            throw new Error(`Erro de rede ou arquivo não encontrado. Status: ${response.status}`);
        }
        
        const rawData = await response.json();
        constitutionData = flattenConstitutionData(rawData);

        const fuseOptions = {
            threshold: 0.4,
            ignoreLocation: true,
            ignoreDiacritics: true,
            keys: [
                'tituloArtigo',
                'textoCompleto'
            ]
        };

        fuse = new Fuse(constitutionData, fuseOptions);

    } catch (error) {
        console.error("Falha na inicialização:", error);
        resultsContainer.innerHTML = `
            <div style="color: red; border: 1px solid red; padding: 10px;">
                <strong>Erro ao carregar a aplicação.</strong>
                <p>Não foi possível carregar o arquivo <code>constitution.json</code>.</p>
                <p>Verifique se o arquivo está na pasta 'public'.</p>
                <p>Detalhe do erro: ${error.message}</p>
            </div>
        `;
    }
}

/**
 * Transforma a estrutura hierárquica do JSON constitucional em lista plana de artigos.
 * Essencial para compatibilidade com o motor de busca Fuse.js que requer estrutura uniforme.
 * @param {Object} data - Dados JSON da constituição com estrutura aninhada
 * @returns {Array} Lista de objetos com propriedades 'tituloArtigo' e 'textoCompleto'
 */
function flattenConstitutionData(data) {
    const articlesList = [];
    for (const key in data.titulos) {
        traverseAndExtractArticles(data.titulos[key], articlesList);
    }
    return articlesList;
}

/**
 * Percorre recursivamente a árvore constitucional (títulos > capítulos > seções > artigos).
 * Extrai todos os artigos independente do nível hierárquico, preservando texto completo.
 * @param {Object} node - Nó atual da estrutura hierárquica
 * @param {Array} articlesList - Array acumulador modificado por referência
 */
function traverseAndExtractArticles(node, articlesList) {
    if (node.artigos) {
        for (const key in node.artigos) {
            const article = node.artigos[key];
            const fullText = buildFullArticleText(article);
            articlesList.push({
                tituloArtigo: article.texto[0],
                textoCompleto: fullText
            });
        }
    }
    if (node.capitulos) {
        for (const key in node.capitulos) {
            traverseAndExtractArticles(node.capitulos[key], articlesList);
        }
    }
    if (node.secoes) {
        for (const key in node.secoes) {
            traverseAndExtractArticles(node.secoes[key], articlesList);
        }
    }
}

/**
 * Constrói texto completo do artigo incluindo incisos, parágrafos e alíneas recursivamente.
 * Preserva hierarquia textual com quebras de linha para manter legibilidade.
 * Fundamental para buscas precisas que consideram todo conteúdo do artigo.
 * @param {Object} articleObject - Objeto artigo com estrutura aninhada
 * @returns {String} Texto consolidado com toda hierarquia preservada
 */
function buildFullArticleText(articleObject) {
    let fullText = articleObject.texto[0];
    const extractText = (subNode) => {
        let text = '';
        if (subNode.texto) {
            text += '\n' + subNode.texto[0];
        }
        if (subNode.incisos) {
            for (const key in subNode.incisos) {
                text += extractText(subNode.incisos[key]);
            }
        }
        if (subNode.paragrafos) {
             for (const key in subNode.paragrafos) {
                text += extractText(subNode.paragrafos[key]);
            }
        }
        if (subNode.alineas) {
             for (const key in subNode.alineas) {
                text += extractText(subNode.alineas[key]);
            }
        }
        return text;
    };
    fullText += extractText(articleObject);
    return fullText;
}

/**
 * Processa submissão do formulário de busca com validação e limpeza de estado.
 * Limpa resultados anteriores antes de exibir novos para evitar confusão visual.
 * Requer inicialização prévia do Fuse.js para funcionar.
 * @param {Event} event - Evento de submissão do formulário
 */
function handleSearch(event) {
    event.preventDefault();
    const searchTerm = searchInput.value.trim();
    if (!searchTerm || !fuse) {
        resultsContainer.innerHTML = '';
        selectedArticleContainer.innerHTML = '';
        return;
    }
    const searchResults = fuse.search(searchTerm);
    renderResults(searchResults);
}

/**
 * Renderiza resultados de busca com preview limitado e botões de ação interativos.
 * Cada resultado inclui container oculto para resumo IA, evitando re-renderização.
 * Aplica encoding nos data attributes para prevenir problemas com caracteres especiais.
 * @param {Array} results - Array de resultados do Fuse.js com estrutura {item, score}
 */
function renderResults(results) {
    resultsContainer.innerHTML = '';
    selectedArticleContainer.innerHTML = '';
    if (results.length === 0) {
        resultsContainer.innerHTML = '<p>Nenhum artigo encontrado para o termo pesquisado.</p>';
        return;
    }
    results.forEach(result => {
        const article = result.item;
        const resultBlock = document.createElement('article');
        resultBlock.style.border = '1px solid black';
        resultBlock.style.padding = '10px';
        resultBlock.style.marginBottom = '15px';
        const textSnippet = article.textoCompleto.substring(0, 250) + '...';
        resultBlock.innerHTML = `
            <h3>${article.tituloArtigo}</h3>
            <p>${textSnippet}</p>
            <button class="summarize-article-btn" 
                    data-title="${encodeURIComponent(article.tituloArtigo)}" 
                    data-full-text="${encodeURIComponent(article.textoCompleto)}">
                Resumir com IA
            </button>
            <div class="summary-container" style="margin-top: 10px; padding: 10px; border: 1px solid #ddd; background-color: #f9f9f9; display: none;">
                <strong>Resumo:</strong>
                <div class="summary-content"></div>
            </div>
            <hr>
        `;
        resultsContainer.appendChild(resultBlock);
    });
}

/**
 * Gerencia cliques no botão de resumo com estado inteligente e controle de loading.
 * Implementa toggle de visibilidade para resumos já gerados, evitando chamadas desnecessárias à API.
 * Desabilita botão durante processamento para prevenir múltiplas requisições simultâneas.
 * @param {Event} event - Evento de clique com propagação por event delegation
 */
async function handleSummarizeClick(event) {
    const targetButton = event.target.closest('.summarize-article-btn');
    if (targetButton) {
        const title = decodeURIComponent(targetButton.dataset.title);
        const fullText = decodeURIComponent(targetButton.dataset.fullText);
        
        const summaryContainer = targetButton.parentElement.querySelector('.summary-container');
        const summaryContent = targetButton.parentElement.querySelector('.summary-content');
        
        if (summaryContainer.style.display === 'block' && summaryContent.innerHTML.trim() !== '') {
            summaryContainer.style.display = summaryContainer.style.display === 'none' ? 'block' : 'none';
            return;
        }
        
        summaryContainer.style.display = 'block';
        summaryContent.innerHTML = '<em>Gerando resumo com IA...</em>';
        targetButton.disabled = true;
        targetButton.textContent = 'Processando...';
        
        try {
            const summary = await getSummaryFromGemini(fullText);
            summaryContent.innerHTML = summary.replace(/\n/g, '<br>');
        } catch (error) {
            console.error('Erro ao gerar resumo:', error);
            summaryContent.innerHTML = `<span style="color: red;">Erro ao gerar resumo: ${error.message}</span>`;
        } finally {
            targetButton.disabled = false;
            targetButton.textContent = 'Resumir com IA';
        }
    }
}

/**
 * Chama API Gemini 2.0 Flash com prompt jurídico especializado e configurações de segurança.
 * Usa configurações permissivas de segurança para conteúdo legal que pode ser flagrado incorretamente.
 * Inclui tratamento robusto de erros com mensagens específicas para diferentes cenários de falha.
 * @param {String} articleText - Texto completo do artigo constitucional para resumir
 * @returns {Promise<String>} Resumo em linguagem simples gerado pela IA
 * @throws {Error} Erros de configuração, rede ou resposta inválida da API
 */
async function getSummaryFromGemini(articleText) {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'sua_chave_da_api_gemini_aqui') {
        throw new Error('Chave da API do Gemini não configurada. Verifique o arquivo .env');
    }
    
    const prompt = `Você é um assistente jurídico especializado na constituição brasileira. Leia o seguinte trecho da constituição e o resuma usando uma linguagem simples:\n\n${articleText}`;
    
    const requestBody = {
        contents: [{
            role: "user",
            parts: [{
                text: prompt
            }]
        }],
        generationConfig: {},
        safetySettings: [
            {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_NONE"
            },
            {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_NONE"
            },
            {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_NONE"
            },
            {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_NONE"
            }
        ]
    };
    
    try {
        const response = await axios.post(GEMINI_API_URL, requestBody, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.data && response.data.candidates && response.data.candidates[0]) {
            return response.data.candidates[0].content.parts[0].text;
        } else {
            throw new Error('Resposta inválida da API do Gemini');
        }
    } catch (error) {
        if (error.response) {
            const errorMessage = error.response.data?.error?.message || JSON.stringify(error.response.data) || 'Erro desconhecido';
            throw new Error(`Erro da API: ${error.response.status} - ${errorMessage}`);
        } else {
            throw new Error(`Erro de conexão: ${error.message}`);
        }
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);
searchForm.addEventListener('submit', handleSearch);
resultsContainer.addEventListener('click', handleSummarizeClick);
