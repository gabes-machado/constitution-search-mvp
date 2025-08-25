import {
  IsString,
  IsOptional,
  IsUrl,
  IsNumber,
  IsObject,
  IsIn,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Hierarchical context for constitution elements
 */
export class HierarchicalContext {
  @ApiPropertyOptional({ description: 'Title context' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Chapter context' })
  @IsOptional()
  @IsString()
  chapter?: string;

  @ApiPropertyOptional({ description: 'Section context' })
  @IsOptional()
  @IsString()
  section?: string;

  @ApiPropertyOptional({ description: 'Sub-section context' })
  @IsOptional()
  @IsString()
  subSection?: string;

  @ApiPropertyOptional({ description: 'Article number for parent context' })
  @IsOptional()
  @IsString()
  articleNumber?: string;
}

/**
 * Represents the raw data units extracted directly from parsing the Constitution's HTML.
 * Each instance typically corresponds to a distinct semantic element like an article's main text (caput),
 * an inciso, an alínea, or a paragraph.
 */
export class RawConstitutionDataItem {
  @ApiProperty({
    description: 'Type of constitutional element',
    enum: [
      'TÍTULO',
      'CAPÍTULO',
      'SEÇÃO',
      'SUBSEÇÃO',
      'Artigo',
      'Parágrafo',
      'Inciso',
      'Alínea',
      'EMENDA CONSTITUCIONAL',
      'ATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS',
      'PREÂMBULO',
      'TEXTO_CONSTITUCIONAL_PROMULGADO',
      'ASSINATURA',
      'LOCAL_DATA',
    ],
  })
  @IsIn([
    'TÍTULO',
    'CAPÍTULO',
    'SEÇÃO',
    'SUBSEÇÃO',
    'Artigo',
    'Parágrafo',
    'Inciso',
    'Alínea',
    'EMENDA CONSTITUCIONAL',
    'ATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS',
    'PREÂMBULO',
    'TEXTO_CONSTITUCIONAL_PROMULGADO',
    'ASSINATURA',
    'LOCAL_DATA',
  ])
  elementType:
    | 'TÍTULO'
    | 'CAPÍTULO'
    | 'SEÇÃO'
    | 'SUBSEÇÃO'
    | 'Artigo'
    | 'Parágrafo'
    | 'Inciso'
    | 'Alínea'
    | 'EMENDA CONSTITUCIONAL'
    | 'ATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS'
    | 'PREÂMBULO'
    | 'TEXTO_CONSTITUCIONAL_PROMULGADO'
    | 'ASSINATURA'
    | 'LOCAL_DATA';

  @ApiProperty({ description: 'Text content of the element' })
  @IsString()
  text: string;

  @ApiProperty({
    description: 'Hierarchical context information',
    type: HierarchicalContext,
  })
  @ValidateNested()
  @Type(() => HierarchicalContext)
  hierarchicalContext: HierarchicalContext;

  @ApiPropertyOptional({
    description: 'Additional attributes (e.g., href for links, ids)',
  })
  @IsOptional()
  @IsObject()
  attributes?: { [key: string]: string };

  @ApiPropertyOptional({
    description: 'Original line number or position in source for debugging',
  })
  @IsOptional()
  @IsNumber()
  lineNumber?: number;

  @ApiProperty({ description: 'Source URL of the document' })
  @IsUrl()
  sourceUrl: string;
}

/**
 * Represents the structured schema for an individual searchable unit (article, inciso, alínea, paragraph)
 * of the Constitution, prepared for indexing in Typesense.
 */
export class ConstitutionIndexSchema {
  @ApiProperty({
    description: 'Unique ID for Typesense document (e.g., "const-art-5-inc-X")',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Type of the constitutional element',
    enum: [
      'Preâmbulo',
      'Artigo',
      'Parágrafo',
      'Inciso',
      'Alínea',
      'Título',
      'Capítulo',
      'Seção',
      'Subseção',
      'ADCTArtigo',
      'EmendaConstitucional',
    ],
  })
  @IsIn([
    'Preâmbulo',
    'Artigo',
    'Parágrafo',
    'Inciso',
    'Alínea',
    'Título',
    'Capítulo',
    'Seção',
    'Subseção',
    'ADCTArtigo',
    'EmendaConstitucional',
  ])
  type:
    | 'Preâmbulo'
    | 'Artigo'
    | 'Parágrafo'
    | 'Inciso'
    | 'Alínea'
    | 'Título'
    | 'Capítulo'
    | 'Seção'
    | 'Subseção'
    | 'ADCTArtigo'
    | 'EmendaConstitucional';

  @ApiPropertyOptional({
    description: 'Specific number (e.g., "5º", "I", "a)", "§ 1º", "1")',
  })
  @IsOptional()
  @IsString()
  number?: string;

  @ApiPropertyOptional({
    description: 'Full reference like "Art. 5º, Inciso I, Alínea a"',
  })
  @IsOptional()
  @IsString()
  fullReference?: string;

  @ApiProperty({ description: 'The actual text content of the element' })
  @IsString()
  text: string;

  @ApiProperty({
    description: 'Concatenated text of parent elements for contextual search',
  })
  @IsString()
  hierarchicalTextContext: string;

  @ApiPropertyOptional({
    description: 'TÍTULO (e.g., "TÍTULO I - DOS PRINCÍPIOS FUNDAMENTAIS")',
  })
  @IsOptional()
  @IsString()
  parentTitle?: string;

  @ApiPropertyOptional({
    description:
      'CAPÍTULO (e.g., "CAPÍTULO I - DOS DIREITOS E DEVERES INDIVIDUAIS E COLETIVOS")',
  })
  @IsOptional()
  @IsString()
  parentChapter?: string;

  @ApiPropertyOptional({
    description: 'SEÇÃO (e.g., "SEÇÃO I - DO PODER LEGISLATIVO")',
  })
  @IsOptional()
  @IsString()
  parentSection?: string;

  @ApiPropertyOptional({ description: 'SUBSEÇÃO' })
  @IsOptional()
  @IsString()
  parentSubSection?: string;

  @ApiPropertyOptional({
    description:
      'Article number if this is an inciso, alinea, or paragraph (e.g., "Art. 5º")',
  })
  @IsOptional()
  @IsString()
  parentArticleNumber?: string;

  @ApiProperty({ description: 'URL of the source document' })
  @IsUrl()
  sourceUrl: string;

  @ApiProperty({
    description: 'Unix timestamp of when the document was last indexed',
  })
  @IsNumber()
  lastIndexedAt: number;

  @ApiPropertyOptional({
    description:
      'Tags (e.g., ["Direitos Fundamentais", "Remédios Constitucionais"])',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
