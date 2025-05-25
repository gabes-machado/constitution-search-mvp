import { Inject, Injectable, Logger } from '@nestjs/common';
import { Client } from 'typesense';
import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';
import { CollectionSchema } from 'typesense/lib/Typesense/Collection';
import { TYPESENSE_CLIENT } from './typesense.provider';

@Injectable()
export class TypesenseService {
  private readonly _logger = new Logger(TypesenseService.name);

  constructor(
    @Inject(TYPESENSE_CLIENT) private readonly _typesenseClient: Client,
  ) {}

  /**
   * Ensures a Typesense collection exists. If not, it creates it based on the provided schema.
   * @param name - The name of the collection.
   * @param schema - The schema for the collection if it needs to be created.
   * @returns A Promise that resolves when the operation is complete.
   */
  async ensureCollectionExists(
    name: string,
    schema: CollectionCreateSchema,
  ): Promise<void> {
    try {
      await this._typesenseClient.collections(name).retrieve();
      this._logger.log(`Collection "${name}" already exists.`);
    } catch (error: any) {
      if (error.httpStatus === 404) {
        this._logger.log(`Collection "${name}" does not exist. Creating...`);
        await this._typesenseClient.collections().create(schema);
        this._logger.log(`Collection "${name}" created successfully.`);
      } else {
        this._logger.error(
          `Error retrieving or creating collection "${name}": ${error.message}`,
          error.stack,
        );
        throw error;
      }
    }
  }

  /**
   * Indexes a batch of documents into the specified Typesense collection.
   * Uses the 'upsert' action.
   * @param collectionName - The name of the collection.
   * @param documents - An array of documents to index.
   * @param batchSize - The number of documents to send in each batch.
   * @returns A Promise that resolves when all documents have been processed.
   */
  async indexDocuments<TDocument extends object>(
    collectionName: string,
    documents: TDocument[],
    batchSize: number = 100,
  ): Promise<void> {
    if (!documents || documents.length === 0) {
      this._logger.warn(
        `No documents provided for indexing in "${collectionName}".`,
      );
      return;
    }

    this._logger.log(
      `Preparing to index ${documents.length} documents into "${collectionName}" in batches of ${batchSize}.`,
    );

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      this._logger.log(
        `Indexing batch ${i / batchSize + 1} with ${batch.length} documents...`,
      );
      try {
        const importResults = await this._typesenseClient
          .collections(collectionName)
          .documents()
          .import(batch, {
            action: 'upsert',
            batch_size: batch.length,
            dirty_values: 'coerce_or_drop',
          }); // Coerce or drop to handle potential type mismatches

        const errors = importResults.filter((result) => !result.success);
        if (errors.length > 0) {
          this._logger.error(
            `${errors.length} errors occurred during batch import to "${collectionName}". First error: ${JSON.stringify(errors[0])}`,
          );
          // Consider logging all errors or a sample if many
        }
      } catch (error: any) {
        this._logger.error(
          `Critical error during batch import to "${collectionName}": ${error.message}`,
          error.importResults
            ? JSON.stringify(error.importResults, null, 2)
            : error.stack,
        );
        // Depending on the error, you might want to re-throw or handle it to continue with other batches
      }
    }
    this._logger.log(
      `Finished indexing all documents into "${collectionName}".`,
    );
  }

  /**
   * Deletes a collection if it exists.
   * @param collectionName The name of the collection to delete.
   */
  async deleteCollectionIfExists(collectionName: string): Promise<void> {
    try {
      await this._typesenseClient.collections(collectionName).retrieve(); // Check if it exists
      this._logger.log(`Collection "${collectionName}" found. Deleting...`);
      await this._typesenseClient.collections(collectionName).delete();
      this._logger.log(`Collection "${collectionName}" deleted successfully.`);
    } catch (error: any) {
      if (error.httpStatus === 404) {
        this._logger.log(
          `Collection "${collectionName}" does not exist. No action taken.`,
        );
      } else {
        this._logger.error(
          `Error deleting collection "${collectionName}": ${error.message}`,
          error.stack,
        );
        throw error;
      }
    }
  }

  /**
   * Retrieves the schema of an existing collection.
   * @param collectionName The name of the collection.
   * @returns A Promise resolving to the CollectionSchema.
   */
  async getCollectionSchema(collectionName: string): Promise<CollectionSchema> {
    try {
      const schema = await this._typesenseClient
        .collections(collectionName)
        .retrieve();
      return schema;
    } catch (error: any) {
      this._logger.error(
        `Error retrieving schema for collection "${collectionName}": ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
