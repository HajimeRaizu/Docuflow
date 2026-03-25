NEMSify: List of Functions and Purposes

This document provides a comprehensive list of the core functions used in the Docuflow application, categorized by their primary domain.

AI & Core Services
generateEmbedding: Generates a vector embedding for a given text string to enable semantic search.
searchSimilarDatasets: Performs a vector search in Supabase for relevant reference materials to provide context to the AI.
generateDocument: The main orchestration function that pulls context and calls Gemini to draft OOXML document content.
enforceOOXMLRules: Sanitizes and formats the AI-generated OOXML to ensure validity and project-specific styling rules to make sure the document is properly populated to the document editor.
generateDatasetContext: Generates a short summary of a document as context and helps with RAG retrieval.
generateDocumentTitle: AI-generated concise title based on document content.
estimateBudget: AI-generated list of items and costs based on activity proposal details.

Document Lifecycle
handleGenerate: Calls the AI service to draft the document based on the current form data.
handleSaveToStorage: Saves the current document content, metadata, and versions to Supabase.
toggleLiveAgent: Manages the connection and state of the Gemini Live voice session.
loadDocs: Fetches the user's documents and shared department documents from Supabase.
handleDelete: Removes a document and its metadata from the database.
handleToggleShare: Updates a document's visibility between 'private' and 'department' level.
handleRollback: Restores a document to a previous version from its history.

Rich Text Editor & Budgeting
loadTemplate: Fetches a DOCX template and injects initial content using JSZip before loading it into the editor.
extractOOXMLBody: Extracts the core content (`<w:body>`) from a DOCX blob.
handleSave: Exports the editor content as a blob and saves it to the database.
handleExportDOCX: Triggers a browser download of the current document as a usable `.docx` file.
syncItemsFromDoc: Parses the document's OOXML to sync its internal price table with the UI state.
handleInsertPriceTable: Generates a formatted OOXML budget table and inserts it into the document.

App & User Management
handleSession: Manages the user's authentication state, profile, and role-based permissions.
handleNavigate: Controls the application's top-level routing and view state.
saveAISettings: Persists the user's AI preference settings (tone, length) to local storage.
fetchDatasets: Retrieves reference datasets from Supabase for administrative review.
handleDeleteDataset: Removes a reference dataset from the system.
