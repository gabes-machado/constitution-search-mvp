import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import * as cheerio from 'cheerio';
import { firstValueFrom } from 'rxjs';
import {
  RawConstitutionDataItem,
  ConstitutionIndexSchema,
} from './dto/constitution-data.dto';
import { TypesenseService } from '../typesense/typesense.service';
import { CacheService } from '../cache/cache.service';
import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

// Collection name will be retrieved from environment variables

@Injectable()
export class ConstitutionScrapingService {
  private readonly _logger = new Logger(ConstitutionScrapingService.name);
  private readonly _constitutionUrl: string;
  private readonly _collectionName: string;
  private readonly _batchSize: number;

  constructor(
    private readonly _httpService: HttpService,
    private readonly _typesenseService: TypesenseService,
    private readonly _configService: ConfigService,
    private readonly _cacheService: CacheService,
  ) {
    this._constitutionUrl = this._configService.get<string>(
      'CONSTITUTION_URL',
      'https://www.planalto.gov.br/ccivil_03/constituicao/ConstituicaoCompilado.htm',
    );
    this._collectionName = this._configService.get<string>(
      'CONSTITUTION_COLLECTION_NAME',
      'brazilian_constitution_v1',
    );
    this._batchSize = this._configService.get<number>(
      'INDEXING_BATCH_SIZE',
      200,
    );
  }

  /**
   * Method to get the Typesense schema with dynamic collection name
   */
  private _getTypesenseSchema(): CollectionCreateSchema {
    return {
      name: this._collectionName,
      fields: [
        { name: 'id', type: 'string' },
        { name: 'type', type: 'string', facet: true },
        {
          name: 'number',
          type: 'string',
          optional: true,
          facet: true,
          sort: true,
        },
        {
          name: 'fullReference',
          type: 'string',
          infix: true,
          sort: true,
        },
        { name: 'text', type: 'string', infix: true },
        {
          name: 'hierarchicalTextContext',
          type: 'string',
          infix: true,
          optional: true,
        },
        { name: 'parentTitle', type: 'string', optional: true, facet: true },
        { name: 'parentChapter', type: 'string', optional: true, facet: true },
        { name: 'parentSection', type: 'string', optional: true, facet: true },
        {
          name: 'parentSubSection',
          type: 'string',
          optional: true,
          facet: true,
        },
        {
          name: 'parentArticleNumber',
          type: 'string',
          optional: true,
          facet: true,
        },
        { name: 'sourceUrl', type: 'string' },
        { name: 'lastIndexedAt', type: 'int64', sort: true },
        {
          name: 'tags',
          type: 'string[]',
          optional: true,
          facet: true,
          infix: true,
        },
        {
          name: 'embedding',
          type: 'float[]',
          embed: {
            from: ['text', 'fullReference', 'hierarchicalTextContext'],
            model_config: {
              model_name: 'ts/all-MiniLM-L12-v2',
            },
          },
        },
      ],
      default_sorting_field: 'fullReference',
      token_separators: [' ', '-', '.', ',', '/', '(', ')', ':'],
    };
  }

  /**
   * Fetches the HTML content of the Brazilian Constitution.
   * Handles character encoding specific to the source.
   * @returns The HTML content as a string.
   */
  private async _fetchConstitutionHtml(): Promise<string> {
    this._logger.log(`Fetching HTML from ${this._constitutionUrl}`);

    // Try to get from cache first
    const cachedHtml = await this._cacheService.getHtmlContent(
      this._constitutionUrl,
    );
    if (cachedHtml) {
      this._logger.log('Using cached HTML content');
      return cachedHtml;
    }

    try {
      this._logger.log('Fetching fresh HTML from external source');
      const response = await firstValueFrom(
        this._httpService.get(this._constitutionUrl, {
          responseType: 'arraybuffer',
          transformResponse: [
            (data) => Buffer.from(data, 'binary').toString('latin1'),
          ],
          timeout: 30000, // 30 second timeout
        }),
      );

      const htmlContent = response.data;
      this._logger.log('Successfully fetched HTML from external source');

      // Cache the HTML content for future use (24 hours TTL)
      await this._cacheService.setHtmlContent(
        this._constitutionUrl,
        htmlContent,
        24 * 60 * 60,
      );

      return htmlContent;
    } catch (error: any) {
      this._logger.error(
        `Error fetching constitution HTML: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Parses the raw HTML content into a structured list of RawConstitutionDataItem.
   * This is the most complex part and requires careful, iterative refinement
   * based on the specific HTML structure of the constitution page.
   * @param htmlContent - The raw HTML string.
   * @returns An array of RawConstitutionDataItem.
   */
  private _parseConstitutionHtml(
    htmlContent: string,
  ): RawConstitutionDataItem[] {
    this._logger.log('Starting HTML parsing for the Constitution...');
    const $ = cheerio.load(htmlContent);
    const items: RawConstitutionDataItem[] = [];

    let currentContext: Partial<
      RawConstitutionDataItem['hierarchicalContext']
    > = {};
    let lineNumber = 0;

    // Iterate over relevant tags. The Planalto website uses <p> tags heavily.
    // This selector attempts to capture most relevant textual content.
    $('body p').each((_idx, el) => {
      lineNumber++;
      const element = $(el);
      let text = element.text().trim().replace(/\s\s+/g, ' '); // Normalize whitespace

      // Skip known boilerplate or empty tags
      if (
        !text ||
        text.length < 3 ||
        /PRESIDÊNCIA DA REPÚBLICA|CASA CIVIL|Subchefia para Assuntos Jurídicos/i.test(
          text,
        )
      ) {
        return;
      }
      // Skip navigation links often found in headers/footers of such pages
      if (
        element.parents('table').length > 0 &&
        element.find('a[href*="planalto.gov.br"]').length > 0 &&
        element.text().length < 100
      ) {
        // Heuristic for typical header/footer links inside tables
        return;
      }
      if (element.find('img[src*="brasao.png"]').length > 0) return; // Skip header with coat of arms

      let elementType: RawConstitutionDataItem['elementType'] | null = null;
      const attributes: { [key: string]: string } = {};
      if (element.find('a').length > 0) {
        attributes['href'] = element.find('a').attr('href') || '';
      }

      // --- Context Detection (Titles, Chapters, Sections) ---
      // These are heuristics and highly dependent on Planalto's specific (and often inconsistent) formatting.
      // Relies on text content, font tags, and bold tags. This section requires the most testing and refinement.

      // Emenda Constitucional (often centered, bold, specific font)
      if (
        /^EMENDA CONSTITUCIONAL Nº \d+/i.test(text) &&
        (element.attr('align') === 'center' || element.find('b').length > 0)
      ) {
        elementType = 'EMENDA CONSTITUCIONAL';
        // Reset context as it's a new top-level declaration
        currentContext = { title: text };
      }
      // ATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS
      else if (
        /^ATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS/i.test(text) &&
        (element.attr('align') === 'center' || element.find('b').length > 0)
      ) {
        elementType = 'ATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS';
        currentContext = { title: text }; // Reset for ADCT
      }
      // PREÂMBULO
      else if (
        /^PREÂMBULO/i.test(text) &&
        (element.attr('align') === 'center' || element.find('b').length > 0)
      ) {
        elementType = 'PREÂMBULO';
        currentContext = { title: text }; // Preâmbulo is its own context
      }
      // TÍTULO (Usually centered, bold, larger font)
      else if (
        text.startsWith('TÍTULO') &&
        (element.attr('align') === 'center' || element.find('b').length > 0)
      ) {
        elementType = 'TÍTULO';
        currentContext = {
          title: text,
          chapter: undefined,
          section: undefined,
          subSection: undefined,
          articleNumber: undefined,
        };
      }
      // CAPÍTULO
      else if (
        text.startsWith('CAPÍTULO') &&
        (element.attr('align') === 'center' || element.find('b').length > 0)
      ) {
        elementType = 'CAPÍTULO';
        currentContext.chapter = text;
        currentContext.section = undefined;
        currentContext.subSection = undefined;
        currentContext.articleNumber = undefined;
      }
      // SEÇÃO
      else if (
        text.startsWith('Seção ') &&
        (element.attr('align') === 'center' || element.find('b').length > 0)
      ) {
        // Note: "Seção" not always all caps
        elementType = 'SEÇÃO';
        currentContext.section = text;
        currentContext.subSection = undefined;
        currentContext.articleNumber = undefined;
      }
      // SUBSEÇÃO
      else if (
        text.startsWith('Subseção ') &&
        (element.attr('align') === 'center' || element.find('b').length > 0)
      ) {
        elementType = 'SUBSEÇÃO';
        currentContext.subSection = text;
        currentContext.articleNumber = undefined;
      }
      // Artigo (Art. Xº ...)
      else if (/^Art\.\s*\d+º?\.?/i.test(text)) {
        elementType = 'Artigo';
        currentContext.articleNumber = text.match(/^Art\.\s*\d+º?\.?/i)?.[0];
        // Text of the article often continues after the "Art. Xº." part
        text = text.replace(/^Art\.\s*\d+º?\.?\s*/i, '').trim();
        if (text.length === 0 && element.next('p').length > 0) {
          // Sometimes the article text is in the next <p>
          text = element.next('p').text().trim().replace(/\s\s+/g, ' ');
        }
      }
      // Parágrafo (§ Xº ...)
      else if (
        /^§\s*\d+º?\.?/i.test(text) ||
        text.startsWith('Parágrafo único.')
      ) {
        elementType = 'Parágrafo';
      }
      // Inciso (Roman numerals I, II, ..., or with text like "Inciso X -")
      else if (
        /^([IVXLCDM]+)\s*-\s*/.test(text) ||
        text.toLowerCase().startsWith('inciso ')
      ) {
        elementType = 'Inciso';
      }
      // Alínea (letters a), b) ...)
      else if (/^[a-z]\)\s+/.test(text)) {
        elementType = 'Alínea';
      }
      // Assinatura (Name of signatories at the end, often all caps)
      else if (
        element.attr('align') === 'center' &&
        text === text.toUpperCase() &&
        text.split(' ').length >= 2 &&
        text.split(' ').length <= 5 &&
        $(el).nextAll('p:contains("Brasília")').length > 0
      ) {
        elementType = 'ASSINATURA';
      }
      // Local e Data (Brasília, ...)
      else if (
        /^Brasília,\s*\d+\s*de\s*[a-zA-Z]+\s*de\s*\d{4}\./i.test(text) &&
        element.attr('align') === 'center'
      ) {
        elementType = 'LOCAL_DATA';
      }
      // Texto Constitucional Promulgado (the final declaration)
      else if (
        /^Nós, representantes do povo brasileiro/i.test(text) ||
        /A ASSEMBLEIA NACIONAL CONSTITUINTE/i.test(text)
      ) {
        elementType = 'TEXTO_CONSTITUCIONAL_PROMULGADO';
        // This might also be part of Preâmbulo or a distinct section
      }

      // If type still not determined, and it's not a clear structural element,
      // it might be a continuation of the previous element or general text.
      if (!elementType && text.length > 10) {
        // Avoid very short, possibly noise, texts
        if (currentContext.articleNumber) {
          elementType = 'Artigo'; // Or a more generic 'Content' type
        } else if (
          currentContext.title ||
          currentContext.chapter ||
          currentContext.section ||
          currentContext.subSection
        ) {
          // If we are inside a Title/Chapter/Section/SubSection but not an Article yet,
          // it could be introductory text for that section.
          // Assign it based on the most specific parent context available.
          if (currentContext.subSection) elementType = 'SUBSEÇÃO';
          else if (currentContext.section) elementType = 'SEÇÃO';
          else if (currentContext.chapter) elementType = 'CAPÍTULO';
          else if (currentContext.title) elementType = 'TÍTULO';
        }
      }

      if (elementType && text) {
        items.push({
          elementType,
          text,
          hierarchicalContext: { ...currentContext }, // Capture current context
          attributes,
          lineNumber,
          sourceUrl: this._constitutionUrl,
        });
      } else if (text && text.length > 20) {
        // Log unclassified longer texts
        this._logger.debug(
          `Unclassified text (line ${lineNumber}, context: ${JSON.stringify(currentContext)}): ${text.substring(0, 100)}...`,
        );
      }
    });

    this._logger.log(`HTML parsing finished. Found ${items.length} raw items.`);
    if (items.length === 0) {
      this._logger.warn(
        'Parser did not extract any items. Review selectors and HTML structure.',
      );
    }
    return items;
  }

  /**
   * Transforms the raw parsed data into the structured format required for Typesense indexing.
   * @param rawItems - Array of RawConstitutionDataItem from the parser.
   * @returns Array of ConstitutionIndexSchema documents.
   */
  private _transformData(
    rawItems: RawConstitutionDataItem[],
  ): ConstitutionIndexSchema[] {
    this._logger.log(
      `Transforming ${rawItems.length} raw items for Typesense...`,
    );
    const documents: ConstitutionIndexSchema[] = [];
    const now = Math.floor(Date.now() / 1000);

    let currentFullReferenceParts: string[] = [];
    let lastArticleNumberForContext: string | undefined;

    for (const item of rawItems) {
      let idSuffix =
        item.text.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '') +
        '-' +
        item.lineNumber;
      let itemNumber: string | undefined;
      let typeForIndex: ConstitutionIndexSchema['type'] =
        item.elementType as ConstitutionIndexSchema['type']; // Initial cast

      // Build full reference and extract item number
      if (item.elementType === 'TÍTULO') {
        currentFullReferenceParts = [item.text];
        lastArticleNumberForContext = undefined;
      } else if (item.elementType === 'CAPÍTULO') {
        currentFullReferenceParts = [
          item.hierarchicalContext.title || 'Desconhecido',
          item.text,
        ];
        lastArticleNumberForContext = undefined;
      } else if (item.elementType === 'SEÇÃO') {
        currentFullReferenceParts = [
          item.hierarchicalContext.title || 'Desconhecido',
          item.hierarchicalContext.chapter || 'Desconhecido',
          item.text,
        ];
        lastArticleNumberForContext = undefined;
      } else if (item.elementType === 'SUBSEÇÃO') {
        currentFullReferenceParts = [
          item.hierarchicalContext.title || 'Desconhecido',
          item.hierarchicalContext.chapter || 'Desconhecido',
          item.hierarchicalContext.section || 'Desconhecido',
          item.text,
        ];
        lastArticleNumberForContext = undefined;
      } else if (item.elementType === 'Artigo') {
        itemNumber =
          item.hierarchicalContext.articleNumber ||
          item.text.match(/^Art\.\s*\d+º?\.?/i)?.[0];
        if (itemNumber) {
          currentFullReferenceParts = [
            item.hierarchicalContext.title || '',
            item.hierarchicalContext.chapter || '',
            item.hierarchicalContext.section || '',
            item.hierarchicalContext.subSection || '',
            itemNumber,
          ].filter(Boolean);
          lastArticleNumberForContext = itemNumber;
        }
        typeForIndex = 'Artigo';
      } else if (item.elementType === 'Parágrafo') {
        itemNumber = item.text.match(/^§\s*\d+º?\.?|^Parágrafo único\./i)?.[0];
        if (itemNumber) currentFullReferenceParts.push(itemNumber);
        typeForIndex = 'Parágrafo';
      } else if (item.elementType === 'Inciso') {
        itemNumber =
          item.text.match(/^([IVXLCDM]+)\s*-/i)?.[1] ||
          item.text.match(/^Inciso\s+([IVXLCDM]+)/i)?.[1];
        if (itemNumber) currentFullReferenceParts.push(`Inciso ${itemNumber}`);
        typeForIndex = 'Inciso';
      } else if (item.elementType === 'Alínea') {
        itemNumber = item.text.match(/^([a-z])\)/i)?.[1];
        if (itemNumber) currentFullReferenceParts.push(`Alínea ${itemNumber}`);
        typeForIndex = 'Alínea';
      } else if (
        item.elementType === 'PREÂMBULO' ||
        item.elementType === 'TEXTO_CONSTITUCIONAL_PROMULGADO' ||
        item.elementType === 'EMENDA CONSTITUCIONAL' ||
        item.elementType === 'ATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS'
      ) {
        currentFullReferenceParts = [item.text];
        lastArticleNumberForContext = undefined; // Reset article context for these top-level elements
        typeForIndex = item.elementType as ConstitutionIndexSchema['type'];
        if (
          item.elementType ===
            'ATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS' &&
          /^Art\.\s*\d+º?\.?/i.test(item.text)
        ) {
          // ADCT articles are special
          typeForIndex = 'ADCTArtigo';
          itemNumber = item.text.match(/^Art\.\s*\d+º?\.?/i)?.[0];
          currentFullReferenceParts.push(itemNumber || 'Artigo ADCT');
        }
      } else {
        // For unclassified items that made it through, or ASSINATURA, LOCAL_DATA which we might not index
        this._logger.debug(
          `Skipping transformation for item type: ${item.elementType} - Text: ${item.text.substring(0, 50)}`,
        );
        continue;
      }

      const fullReference = currentFullReferenceParts
        .filter((p) => p && p.trim() !== '')
        .join(', ');
      idSuffix =
        fullReference.replace(/[^a-zA-Z0-9]/g, '-') + '-' + item.lineNumber;

      const doc: ConstitutionIndexSchema = {
        id: `const-${idSuffix.toLowerCase()}`.slice(0, 512), // Ensure ID is not too long and unique
        type: typeForIndex,
        number: itemNumber?.trim(),
        fullReference,
        text: item.text.replace(itemNumber || '', '').trim(), // Remove the number part from the main text if present
        hierarchicalTextContext:
          [
            item.hierarchicalContext.title,
            item.hierarchicalContext.chapter,
            item.hierarchicalContext.section,
            item.hierarchicalContext.subSection,
            // Add text of parent article if this is an inciso/alinea/paragraph
            item.elementType !== 'Artigo' &&
            item.hierarchicalContext.articleNumber
              ? rawItems.find(
                  (r) =>
                    r.elementType === 'Artigo' &&
                    r.hierarchicalContext.articleNumber ===
                      item.hierarchicalContext.articleNumber,
                )?.text || ''
              : '',
          ]
            .filter(Boolean)
            .join(' | ') + ` | ${item.text}`,
        parentTitle: item.hierarchicalContext.title,
        parentChapter: item.hierarchicalContext.chapter,
        parentSection: item.hierarchicalContext.section,
        parentSubSection: item.hierarchicalContext.subSection,
        parentArticleNumber:
          item.elementType !== 'Artigo'
            ? item.hierarchicalContext.articleNumber ||
              lastArticleNumberForContext
            : undefined,
        sourceUrl: item.sourceUrl,
        lastIndexedAt: now,
        tags: this._extractTags(item.text, item.hierarchicalContext),
      };
      documents.push(doc);
    }
    this._logger.log(
      `Transformed ${documents.length} documents for Typesense.`,
    );
    return documents;
  }

  private _extractTags(
    text: string,
    context: RawConstitutionDataItem['hierarchicalContext'],
  ): string[] {
    const tags: Set<string> = new Set();
    if (context.title) tags.add(context.title.substring(0, 50));
    if (context.chapter) tags.add(context.chapter.substring(0, 50));

    // Example keyword-based tagging (very basic)
    if (text.match(/direitos e garantias fundamentais/i))
      tags.add('Direitos Fundamentais');
    if (text.match(/habeas corpus/i)) tags.add('Habeas Corpus');
    if (text.match(/poder legislativo/i)) tags.add('Poder Legislativo');
    if (text.match(/poder executivo/i)) tags.add('Poder Executivo');
    if (text.match(/poder judiciário/i)) tags.add('Poder Judiciário');
    if (text.match(/ordem econômica e financeira/i))
      tags.add('Ordem Econômica');
    if (text.match(/meio ambiente/i)) tags.add('Meio Ambiente');

    return Array.from(tags);
  }

  /**
   * Main public method to orchestrate the scraping and indexing process.
   * @returns A promise that resolves when the process is complete.
   */
  public async processConstitution(): Promise<void> {
    this._logger.log('Starting full constitution processing...');
    try {
      // Optional: Delete existing collection for a fresh start during MVP development
      // await this._typesenseService.deleteCollectionIfExists(this._collectionName);

      await this._typesenseService.ensureCollectionExists(
        this._collectionName,
        this._getTypesenseSchema(),
      );

      const html = await this._fetchConstitutionHtml();
      const rawData = this._parseConstitutionHtml(html);

      if (rawData.length === 0) {
        this._logger.warn('No data parsed from HTML. Aborting indexing.');
        return;
      }

      const documentsToIndex = this._transformData(rawData);

      if (documentsToIndex.length > 0) {
        await this._typesenseService.indexDocuments(
          this._collectionName,
          documentsToIndex,
          this._batchSize,
        );
      } else {
        this._logger.warn('No documents were transformed for indexing.');
      }
      this._logger.log('Constitution processing and indexing completed.');
    } catch (error: any) {
      this._logger.error(
        `Critical error during constitution processing: ${error.message}`,
        error.stack,
      );
    }
  }
}
