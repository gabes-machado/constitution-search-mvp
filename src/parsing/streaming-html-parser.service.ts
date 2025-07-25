import { Injectable, Logger } from '@nestjs/common';
import { Transform, Readable } from 'stream';
import { pipeline } from 'stream/promises';
import * as cheerio from 'cheerio';
import { RawConstitutionDataItem } from '../constitution/dto/constitution-data.dto';

/**
 * Options for streaming HTML parsing.
 */
export interface StreamingParseOptions {
  chunkSize?: number;
  maxMemoryUsage?: number;
  onProgress?: (processed: number, total?: number) => void;
  onItem?: (item: RawConstitutionDataItem) => void;
}

@Injectable()
export class StreamingHtmlParserService {
  private readonly logger = new Logger(StreamingHtmlParserService.name);

  /**
   * Parse HTML content using streaming approach to reduce memory usage.
   * @param htmlContent - The HTML content to parse.
   * @param sourceUrl - The URL of the source document.
   * @param options - The options for parsing.
   * @returns A promise that resolves to an array of RawConstitutionDataItem objects.
   */
  async parseHtmlStream(
    htmlContent: string,
    sourceUrl: string,
    options: StreamingParseOptions = {},
  ): Promise<RawConstitutionDataItem[]> {
    const {
      chunkSize = 8192, // 8KB chunks
      maxMemoryUsage = 50 * 1024 * 1024, // 50MB max memory
      onProgress,
      onItem,
    } = options;

    this.logger.log(`Starting streaming HTML parsing with chunk size ${chunkSize}`);

    const results: RawConstitutionDataItem[] = [];
    let processedBytes = 0;
    let currentContext: Partial<RawConstitutionDataItem['hierarchicalContext']> = {};
    let lineNumber = 0;

    try {
      // Create a readable stream from the HTML content
      const htmlStream = Readable.from(this.createHtmlChunks(htmlContent, chunkSize));

      // Create a transform stream for processing chunks
      const parseTransform = new Transform({
        objectMode: true,
        transform: (chunk: string, encoding, callback) => {
          try {
            const items = this.parseHtmlChunk(chunk, sourceUrl, currentContext, lineNumber);
            
            // Update context and line number for next chunk
            if (items.length > 0) {
              const lastItem = items[items.length - 1];
              currentContext = { ...lastItem.hierarchicalContext };
              lineNumber += chunk.split('\n').length;
            }

            // Process each item
            for (const item of items) {
              if (onItem) {
                onItem(item);
              }
              results.push(item);
            }

            processedBytes += Buffer.byteLength(chunk, 'utf8');
            
            if (onProgress) {
              onProgress(processedBytes, Buffer.byteLength(htmlContent, 'utf8'));
            }

            // Check memory usage
            const memoryUsage = process.memoryUsage();
            if (memoryUsage.heapUsed > maxMemoryUsage) {
              this.logger.warn(`Memory usage (${memoryUsage.heapUsed}) exceeds limit (${maxMemoryUsage})`);
              // Could implement memory pressure handling here
            }

            callback(null, items);
          } catch (error) {
            callback(error);
          }
        },
      });

      // Process the stream
      await pipeline(htmlStream, parseTransform);

      this.logger.log(`Streaming HTML parsing completed. Processed ${results.length} items`);
      return results;

    } catch (error: any) {
      this.logger.error(`Error in streaming HTML parsing: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create chunks from HTML content for streaming processing.
   * @param htmlContent - The HTML content to create chunks from.
   * @param chunkSize - The size of each chunk.
   * @returns A generator that yields chunks of HTML content.
   */
  private *createHtmlChunks(htmlContent: string, chunkSize: number): Generator<string> {
    let position = 0;
    let buffer = '';

    while (position < htmlContent.length) {
      const chunk = htmlContent.slice(position, position + chunkSize);
      buffer += chunk;

      // Try to break at tag boundaries to avoid splitting HTML elements
      const lastTagEnd = buffer.lastIndexOf('>');
      if (lastTagEnd > 0 && buffer.length > chunkSize) {
        const completeChunk = buffer.slice(0, lastTagEnd + 1);
        buffer = buffer.slice(lastTagEnd + 1);
        yield completeChunk;
      }

      position += chunkSize;
    }

    // Yield remaining buffer
    if (buffer.length > 0) {
      yield buffer;
    }
  }

  /**
   * Parse a chunk of HTML content.
   * @param htmlChunk - The HTML chunk to parse.
   * @param sourceUrl - The URL of the source document.
   * @param context - The hierarchical context of the chunk.
   * @param startLineNumber - The starting line number of the chunk.
   * @returns An array of RawConstitutionDataItem objects.
   */
  private parseHtmlChunk(
    htmlChunk: string,
    sourceUrl: string,
    context: Partial<RawConstitutionDataItem['hierarchicalContext']>,
    startLineNumber: number,
  ): RawConstitutionDataItem[] {
    const items: RawConstitutionDataItem[] = [];

    try {
      // Load the chunk with cheerio
      const $ = cheerio.load(htmlChunk, { 
        xmlMode: false,
        decodeEntities: true,
        normalizeWhitespace: true,
      });

      let lineNumber = startLineNumber;

      // Process each element in the chunk
      $('*').each((index, element) => {
        const $element = $(element);
        const tagName = element.type === 'tag' ? element.name?.toLowerCase() : undefined;
        const text = $element.text().trim();

        if (!text || text.length < 10) {
          return; // Skip empty or very short elements
        }

        // Detect constitutional elements based on patterns
        const elementType = this.detectElementType(text, tagName);
        if (!elementType) {
          return; // Skip non-constitutional elements
        }

        // Update context based on element type
        const updatedContext = this.updateContext(context, elementType, text);

        // Create the parsed item
        const item: RawConstitutionDataItem = {
          elementType,
          text,
          hierarchicalContext: updatedContext,
          attributes: this.extractAttributes($element),
          lineNumber: lineNumber++,
          sourceUrl,
        };

        items.push(item);
      });

    } catch (error: any) {
      this.logger.error(`Error parsing HTML chunk: ${error.message}`);
      // Don't throw - continue processing other chunks
    }

    return items;
  }

  /**
   * Detect the type of constitutional element based on text patterns.
   * @param text - The text to detect the element type for.
   * @param tagName - The tag name of the element.
   * @returns The type of constitutional element, or null if not found.
   */
  private detectElementType(text: string, tagName?: string): RawConstitutionDataItem['elementType'] | null {
    // Title patterns
    if (text.match(/^TÍTULO\s+[IVX]+/i)) {
      return 'TÍTULO';
    }

    // Chapter patterns
    if (text.match(/^CAPÍTULO\s+[IVX]+/i)) {
      return 'CAPÍTULO';
    }

    // Section patterns
    if (text.match(/^SEÇÃO\s+[IVX]+/i)) {
      return 'SEÇÃO';
    }

    // Subsection patterns
    if (text.match(/^SUBSEÇÃO\s+[IVX]+/i)) {
      return 'SUBSEÇÃO';
    }

    // Article patterns
    if (text.match(/^Art\.\s*\d+/i)) {
      return 'Artigo';
    }

    // Paragraph patterns
    if (text.match(/^§\s*\d+/i)) {
      return 'Parágrafo';
    }

    // Inciso patterns
    if (text.match(/^[IVX]+\s*[-–]/i)) {
      return 'Inciso';
    }

    // Alínea patterns
    if (text.match(/^[a-z]\)\s*/i)) {
      return 'Alínea';
    }

    // Preamble
    if (text.includes('Nós, representantes do povo brasileiro')) {
      return 'PREÂMBULO';
    }

    return null; // Not a constitutional element
  }

  /**
   * Update hierarchical context based on element type.
   * @param currentContext - The current hierarchical context.
   * @param elementType - The type of constitutional element.
   * @param text - The text of the element.
   * @returns The updated hierarchical context.
   */
  private updateContext(
    currentContext: Partial<RawConstitutionDataItem['hierarchicalContext']>,
    elementType: RawConstitutionDataItem['elementType'],
    text: string,
  ): RawConstitutionDataItem['hierarchicalContext'] {
    const context = { ...currentContext };

    switch (elementType) {
      case 'TÍTULO':
        context.title = text;
        // Reset lower-level context
        context.chapter = undefined;
        context.section = undefined;
        context.subSection = undefined;
        context.articleNumber = undefined;
        break;

      case 'CAPÍTULO':
        context.chapter = text;
        // Reset lower-level context
        context.section = undefined;
        context.subSection = undefined;
        context.articleNumber = undefined;
        break;

      case 'SEÇÃO':
        context.section = text;
        // Reset lower-level context
        context.subSection = undefined;
        context.articleNumber = undefined;
        break;

      case 'SUBSEÇÃO':
        context.subSection = text;
        context.articleNumber = undefined;
        break;

      case 'Artigo':
        const articleMatch = text.match(/Art\.\s*(\d+)/i);
        if (articleMatch) {
          context.articleNumber = `Art. ${articleMatch[1]}`;
        }
        break;

      // For other types, keep current context
    }

    return context as RawConstitutionDataItem['hierarchicalContext'];
  }

  /**
   * Extract attributes from a cheerio element.
   * @param $element - The cheerio element to extract attributes from.
   * @returns An object containing the extracted attributes.
   */
  private extractAttributes($element: any): { [key: string]: string } {
    const attributes: { [key: string]: string } = {};

    // Extract common attributes
    const id = $element.attr('id');
    if (id) attributes.id = id;

    const className = $element.attr('class');
    if (className) attributes.class = className;

    const href = $element.attr('href');
    if (href) attributes.href = href;

    return attributes;
  }

  /**
   * Get memory usage statistics.
   * @returns An object containing the memory usage statistics.
   */
  getMemoryUsage(): {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  } {
    return process.memoryUsage();
  }
}
