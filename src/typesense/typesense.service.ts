// src/typesense/typesense.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Client } from 'typesense';
import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';
import { CollectionSchema } from 'typesense/lib/Typesense/Collection';
import { ObjectNotFound } from 'typesense/lib/Typesense/Errors'; // Import the specific error type
import { TYPESENSE_CLIENT } from './typesense.provider';

@Injectable()
export class TypesenseService {
  private readonly _logger = new Logger(TypesenseService.name);

  constructor(
    @Inject(TYPESENSE_CLIENT) private readonly _typesenseClient: Client,
  ) {}

  async ensureCollectionExists(
    name: string,
    schema: CollectionCreateSchema,
  ): Promise<void> {
    this._logger.log(`Ensuring collection "${name}" exists...`);
    try {
      this._logger.debug(`Attempting to retrieve collection "${name}"...`);
      await this._typesenseClient.collections(name).retrieve();
      this._logger.log(`Collection "${name}" already exists.`);
    } catch (error: any) {
      // More robust check for the specific "collection not found" error
      if (error instanceof ObjectNotFound) {
        this._logger.log(
          `Collection "${name}" does not exist (ObjectNotFound caught). Attempting to create...`,
        );
        try {
          await this._typesenseClient.collections().create(schema);
          this._logger.log(`Collection "${name}" created successfully.`);
          this._logger.debug(
            `Schema used for creation of "${name}": ${JSON.stringify(schema.fields.map((f) => f.name))}`,
          ); // Log field names for brevity
        } catch (creationError: any) {
          this._logger.error(
            `Failed to CREATE collection "${name}": ${creationError.message}`,
            creationError.stack,
          );
          this._logger.error(
            `Schema that failed creation for "${name}": ${JSON.stringify(schema, null, 2)}`,
          );
          throw creationError;
        }
      } else {
        // An unexpected error occurred during the retrieve operation
        this._logger.error(
          `Error during initial RETRIEVE of collection "${name}" (unexpected type or status): ${error.message} (Status: ${error.httpStatus})`,
          error.stack,
        );
        throw error;
      }
    }
  }

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
        `Indexing batch ${Math.floor(i / batchSize) + 1} with ${batch.length} documents...`,
      );
      try {
        const importResults = await this._typesenseClient
          .collections(collectionName)
          .documents()
          .import(batch, {
            action: 'upsert',
            batch_size: batch.length,
            dirty_values: 'coerce_or_drop',
          });

        const errors = importResults.filter((result) => !result.success);
        if (errors.length > 0) {
          this._logger.error(
            `${errors.length} errors occurred during batch import to "${collectionName}". First error: ${JSON.stringify(errors[0])}`,
          );
        }
      } catch (error: any) {
        this._logger.error(
          `Critical error during batch import to "${collectionName}": ${error.message}`,
          error.importResults
            ? JSON.stringify(error.importResults, null, 2)
            : error.stack,
        );
      }
    }
    this._logger.log(
      `Finished indexing all documents into "${collectionName}".`,
    );
  }

  async deleteCollectionIfExists(collectionName: string): Promise<void> {
    try {
      await this._typesenseClient.collections(collectionName).retrieve();
      this._logger.log(`Collection "${collectionName}" found. Deleting...`);
      await this._typesenseClient.collections(collectionName).delete();
      this._logger.log(`Collection "${collectionName}" deleted successfully.`);
    } catch (error: any) {
      if (error instanceof ObjectNotFound) {
        // Using instanceof here too for consistency
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
