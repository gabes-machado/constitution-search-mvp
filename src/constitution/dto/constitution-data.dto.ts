/**
 * Represents the raw data units extracted directly from parsing the Constitution's HTML.
 * Each instance typically corresponds to a distinct semantic element like an article's main text (caput),
 * an inciso, an alínea, or a paragraph.
 */
export interface RawConstitutionDataItem {
  elementType: 'TÍTULO' | 'CAPÍTULO' | 'SEÇÃO' | 'SUBSEÇÃO' | 'Artigo' | 'Parágrafo' | 'Inciso' | 'Alínea' | 'EMENDA CONSTITUCIONAL' | 'ATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS' | 'PREÂMBULO' | 'TEXTO_CONSTITUCIONAL_PROMULGADO' | 'ASSINATURA' | 'LOCAL_DATA';
  text: string;
  hierarchicalContext: { // Contextual information from parent elements
    title?: string;
    chapter?: string;
    section?: string;
    subSection?: string;
    articleNumber?: string; // The number of the parent article for incisos/alineas/paragraphs
  };
  attributes?: { [key: string]: string }; // e.g., href for links, ids
  lineNumber?: number; // Optional: original line number or position in source for debugging
  sourceUrl: string;
}

/**
 * Represents the structured schema for an individual searchable unit (article, inciso, alínea, paragraph)
 * of the Constitution, prepared for indexing in Typesense.
 */
export interface ConstitutionIndexSchema {
  id: string; // Unique ID for Typesense document (e.g., "const-art-5-inc-X")
  type: 'Preâmbulo' | 'Artigo' | 'Parágrafo' | 'Inciso' | 'Alínea' | 'Título' | 'Capítulo' | 'Seção' | 'Subseção' | 'ADCTArtigo' | 'EmendaConstitucional'; // Type of the constitutional element
  number?: string; // Specific number (e.g., "5º", "I", "a)", "§ 1º", "1")
  fullReference?: string; // Full reference like "Art. 5º, Inciso I, Alínea a"
  text: string; // The actual text content of the element
  hierarchicalTextContext: string; // Concatenated text of parent elements (e.g., Title > Chapter > Section > Article text) for contextual search
  parentTitle?: string; // TÍTULO (e.g., "TÍTULO I - DOS PRINCÍPIOS FUNDAMENTAIS")
  parentChapter?: string; // CAPÍTULO (e.g., "CAPÍTULO I - DOS DIREITOS E DEVERES INDIVIDUAIS E COLETIVOS")
  parentSection?: string; // SEÇÃO (e.g., "SEÇÃO I - DO PODER LEGISLATIVO")
  parentSubSection?: string; // SUBSEÇÃO
  parentArticleNumber?: string; // Article number if this is an inciso, alinea, or paragraph (e.g., "Art. 5º")
  sourceUrl: string; // URL of the source document
  lastIndexedAt: number; // Unix timestamp of when the document was last indexed
  tags?: string[]; // e.g., ["Direitos Fundamentais", "Remédios Constitucionais"]
}