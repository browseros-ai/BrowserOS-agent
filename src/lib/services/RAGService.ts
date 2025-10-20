import { OpenAIEmbeddings } from '@langchain/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

/**
 * RAGService - Retrieval-Augmented Generation Service
 * 
 * This service implements RAG to reduce model perplexity by:
 * 1. Retrieving relevant context from a vector database
 * 2. Augmenting LLM prompts with retrieved information
 * 3. Providing verifiable sources for responses
 */
export class RAGService {
  private vectorStore: MemoryVectorStore | null = null;
  private embeddings: OpenAIEmbeddings;
  private textSplitter: RecursiveCharacterTextSplitter;
  private isInitialized: boolean = false;

  constructor() {
    // Initialize embeddings model
    this.embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-small',
    });

    // Initialize text splitter for chunking documents
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
  }

  /**
   * Initialize the vector store with documents
   * @param documents Array of documents to index
   */
  async initialize(documents: Document[]): Promise<void> {
    try {
      // Split documents into chunks
      const splitDocs = await this.textSplitter.splitDocuments(documents);

      // Create vector store from documents
      this.vectorStore = await MemoryVectorStore.fromDocuments(
        splitDocs,
        this.embeddings
      );

      this.isInitialized = true;
      console.log(`RAGService initialized with ${splitDocs.length} document chunks`);
    } catch (error) {
      console.error('Failed to initialize RAGService:', error);
      throw error;
    }
  }

  /**
   * Add new documents to the vector store
   * @param documents Documents to add
   */
  async addDocuments(documents: Document[]): Promise<void> {
    if (!this.isInitialized || !this.vectorStore) {
      throw new Error('RAGService not initialized. Call initialize() first.');
    }

    try {
      const splitDocs = await this.textSplitter.splitDocuments(documents);
      await this.vectorStore.addDocuments(splitDocs);
      console.log(`Added ${splitDocs.length} document chunks to vector store`);
    } catch (error) {
      console.error('Failed to add documents:', error);
      throw error;
    }
  }

  /**
   * Retrieve relevant documents for a query
   * @param query The user's query
   * @param topK Number of documents to retrieve (default: 4)
   * @returns Array of relevant documents with scores
   */
  async retrieve(
    query: string,
    topK: number = 4
  ): Promise<Document[]> {
    if (!this.isInitialized || !this.vectorStore) {
      console.warn('RAGService not initialized. Returning empty results.');
      return [];
    }

    try {
      // Perform similarity search
      const results = await this.vectorStore.similaritySearch(query, topK);
      console.log(`Retrieved ${results.length} relevant documents for query`);
      return results;
    } catch (error) {
      console.error('Failed to retrieve documents:', error);
      return [];
    }
  }

  /**
   * Retrieve relevant documents with relevance scores
   * @param query The user's query
   * @param topK Number of documents to retrieve (default: 4)
   * @returns Array of documents with relevance scores
   */
  async retrieveWithScores(
    query: string,
    topK: number = 4
  ): Promise<Array<[Document, number]>> {
    if (!this.isInitialized || !this.vectorStore) {
      console.warn('RAGService not initialized. Returning empty results.');
      return [];
    }

    try {
      const results = await this.vectorStore.similaritySearchWithScore(query, topK);
      console.log(`Retrieved ${results.length} documents with scores`);
      return results;
    } catch (error) {
      console.error('Failed to retrieve documents with scores:', error);
      return [];
    }
  }

  /**
   * Build context string from retrieved documents
   * @param documents Retrieved documents
   * @param maxTokens Maximum tokens for context (default: 2000)
   * @returns Formatted context string
   */
  buildContext(
    documents: Document[],
    maxTokens: number = 2000
  ): string {
    if (documents.length === 0) {
      return '';
    }

    let context = '\n\n--- Retrieved Context ---\n';
    let tokenCount = 0;

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const docText = `\n[Source ${i + 1}]\n${doc.pageContent}\n`;
      
      // Rough token estimation (1 token ≈ 4 characters)
      const estimatedTokens = docText.length / 4;
      
      if (tokenCount + estimatedTokens > maxTokens) {
        break;
      }

      context += docText;
      tokenCount += estimatedTokens;
    }

    context += '\n--- End of Context ---\n\n';
    return context;
  }

  /**
   * Augment a prompt with retrieved context
   * @param originalPrompt The original prompt
   * @param query The query to search for relevant context
   * @param topK Number of documents to retrieve
   * @returns Augmented prompt with context
   */
  async augmentPrompt(
    originalPrompt: string,
    query: string,
    topK: number = 4
  ): Promise<string> {
    const documents = await this.retrieve(query, topK);
    
    if (documents.length === 0) {
      return originalPrompt;
    }

    const context = this.buildContext(documents);
    
    return `${context}\n\n${originalPrompt}\n\nPlease use the retrieved context above to provide accurate, well-sourced responses. If the context contains relevant information, prioritize it over general knowledge.`;
  }

  /**
   * Clear the vector store
   */
  async clear(): Promise<void> {
    this.vectorStore = null;
    this.isInitialized = false;
    console.log('RAGService vector store cleared');
  }

  /**
   * Get initialization status
   */
  isReady(): boolean {
    return this.isInitialized && this.vectorStore !== null;
  }
}

// Singleton instance
let ragServiceInstance: RAGService | null = null;

/**
 * Get the RAG service singleton instance
 */
export function getRAGService(): RAGService {
  if (!ragServiceInstance) {
    ragServiceInstance = new RAGService();
  }
  return ragServiceInstance;
}

/**
 * Initialize RAG service with web content
 * This can be called during browser startup
 */
export async function initializeRAGWithWebContent(
  urls: string[]
): Promise<void> {
  const ragService = getRAGService();
  
  // Fetch and process web content
  const documents: Document[] = [];
  
  for (const url of urls) {
    try {
      const response = await fetch(url);
      const text = await response.text();
      
      documents.push(
        new Document({
          pageContent: text,
          metadata: { source: url, timestamp: Date.now() },
        })
      );
    } catch (error) {
      console.error(`Failed to fetch content from ${url}:`, error);
    }
  }

  if (documents.length > 0) {
    await ragService.initialize(documents);
    console.log(`RAG initialized with content from ${documents.length} URLs`);
  }
}
