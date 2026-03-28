# AI-Based Knowledge Graph Builder for Enterprise Intelligence

A full-stack AI system that automatically extracts entities and relationships from large email datasets, builds a semantic knowledge graph, and provides intelligent hybrid retrieval-augmented generation (RAG) for enterprise insights.

This project demonstrates an end-to-end pipeline combining **Neo4j** graph databases, **LLM-powered extraction**, **vector search**, and an **interactive React web interface** for exploring enterprise intelligence.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Project](#running-the-project)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [API Endpoints](#api-endpoints)
- [Troubleshooting](#troubleshooting)
- [Example Queries](#example-queries)

---

## Overview

This system processes enterprise email datasets (built on the Enron Email Dataset) through a sophisticated 3-milestone pipeline:

1. **Data Preparation**: Load emails into Neo4j
2. **Knowledge Extraction** (Milestone 2): Use LLMs to extract entities and relationships
3. **Intelligent Querying** (Milestone 3): Hybrid RAG combining graph and vector search

The result is a searchable knowledge graph that enables complex business intelligence queries like:
- "Who communicated most about natural gas trading?"
- "What relationships involve FERC regulations?"
- "Which people are connected to specific projects?"

---

## Key Features

✨ **Automated Entity Extraction**
- Named Entity Recognition using LLMs
- Identifies: People, Organizations, Locations, Financial Terms, Projects, Energy Terms, Regulations, Events

📊 **Knowledge Graph Storage**
- Neo4j graph database for structured relationships
- Typed relationships between entities
- Efficient relationship traversal for deep insights

🔍 **Hybrid Search Capabilities**
- Vector search via Pinecone for semantic similarity
- Graph traversal for structural relationships
- Combined context for accurate LLM-generated answers

🎨 **Interactive Web Interface**
- React + Vite frontend
- Force-directed graph visualization
- Real-time knowledge graph exploration
- Query interface with streaming responses

⚡ **Production Ready**
- RESTful API backend (Flask)
- CORS enabled for cross-origin requests
- Environment-based configuration
- Error handling and logging

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend (Vite)                   │
│              Graph Visualization & Query Interface          │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/REST API
┌─────────────────────────▼────────────────────────────────────┐
│                    Flask Backend (api.py)                    │
│         Query Processing, Context Retrieval, LLM Call       │
└────────┬──────────────────────────────────────┬──────────────┘
         │                                      │
    ┌────▼────┐                           ┌────▼─────┐
    │   Neo4j  │                           │ Pinecone  │
    │  Graph   │                           │  Vector   │
    │ Database │                           │ Database  │
    └──────────┘                           └───────────┘

Pipeline: Emails → Milestone-2 (Extract) → Neo4j
          Emails → Milestone-3 (Index) → Pinecone + Query
```

---

## Tech Stack

**Backend:**
- Python 3.10+
- Flask (Web server)
- Neo4j Python Driver (Graph database)
- Pinecone SDK (Vector store)
- LangChain (LLM orchestration)
- LLAMA/Groq API (LLM provider)

**Frontend:**
- React 18
- TypeScript
- Vite (Build tool)
- Tailwind CSS (Styling)
- react-force-graph (Visualization)
- react-markdown (Formatted responses)
- Lucide React (Icons)

**Infrastructure:**
- Neo4j AuraDB (Cloud) or Local
- Pinecone (Vector Search SaaS)
- Groq/LLAMA API (LLM)

---

## Prerequisites

1. **Python 3.10+** - Backend runtime
2. **Node.js 16+** - Frontend build
3. **Neo4j Instance** - Database (AuraDB cloud or local installation)
4. **Pinecone Account** - Vector search (free tier available)
5. **Groq/LLAMA API Key** - LLM access (free tier available)
6. **Email Dataset** - CSV with columns: `message_id`, `body` (or `body_cleaned`), `subject`

---

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd AI-Knowledge-Graph-Builder-for-Enterprise-Intelligence
```

### 2. Backend Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Create .env file with your credentials
cp .env.example .env
# Edit .env with your actual credentials
```

### 3. Frontend Setup

```bash
cd frontend

# Install Node dependencies
npm install

# Build TypeScript and assets (or use 'npm run dev' for development)
npm run build

cd ..
```

---

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# LLM API Configuration
LLAMA_API_KEY=your_groq_or_llama_api_key

# Neo4j Configuration
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_neo4j_password
NEO4J_DATABASE=neo4j

# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key

# Flask Configuration (Optional)
FLASK_ENV=production
FLASK_DEBUG=false
```

### Configuration Constants

These are defined in each Python file:

**Milestone-2.py (Entity Extraction)**
```python
BATCH_SIZE = 10              # Emails processed per LLM call
MAX_BODY_CHARS = 3500        # Max email length to process
MAX_RETRIES = 2              # LLM call retries
MODEL_NAME = "ministral-3:14b"  # LLM model
```

**Milestone-3.py & api.py (Query/RAG)**
```python
PINECONE_INDEX = "email-knowledge-graph"
EMBED_MODEL = "multilingual-e5-large"
EMBED_DIM = 1024
VECTOR_TOP_K = 5             # Top K vector results
GRAPH_FACTS_LIMIT = 5        # Max graph relationships
MODEL_NAME = "gpt-oss:120b-cloud"
```

---

## Running the Project

### Complete Pipeline (One-Time Setup)

```bash
# Step 1: Prepare email data in Neo4j
# (Use your data loading script or manual import)

# Step 2: Extract entities and build knowledge graph
python Milestone-2.py

# Step 3: Index emails in Pinecone (one-time)
# In MIlestone-3.py, uncomment the build_vector_index() call
python MIlestone-3.py

# Step 4: Verify with interactive queries
python MIlestone-3.py
# Type your questions at the prompt, 'exit' to quit
```

### Run the Web Application (Recommended)

```bash
# Terminal 1: Start Flask backend
python api.py
# Backend runs on http://localhost:5000

# Terminal 2: Start React frontend (development mode)
cd frontend
npm run dev
# Frontend runs on http://localhost:5000 or http://localhost:5173

# Open browser and navigate to the application
```

---

## Project Structure

```
.
├── README.md                    # This file
├── requirements.txt             # Python dependencies
├── .env                         # Environment variables (git-ignored)
├── .gitignore                   # Git ignore rules
│
├── Milestone-2.py              # Entity extraction pipeline
├── MIlestone-3.py              # Hybrid RAG query interface
├── api.py                       # Flask backend API server
│
├── frontend/                    # React application
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx            # React entry point
│   │   ├── App.tsx             # Main application component
│   │   ├── api.ts              # API client
│   │   ├── types.ts            # TypeScript types
│   │   ├── components/         # React components
│   │   └── styles/             # CSS/Tailwind styles
│   └── dist/                   # Built assets
│
├── attached_assets/            # Static resources
└── result.txt                  # Sample pipeline output logs
```

---

## How It Works

### Phase 1: Preparation
1. Load email dataset into Neo4j as `Email` nodes
2. Each email contains: `message_id`, `subject`, `body`

### Phase 2: Knowledge Extraction (Milestone-2.py)

```
For each unprocessed email batch:
  1. Clean and preprocess email text
  2. Send to LLM with extraction prompt
  3. Parse JSON response containing:
     - Entities: [Person, Organization, Location, ...]
     - Relationships: [type: "communicatedWith", from: X, to: Y]
  4. Validate and normalize extracted data
  5. Create nodes in Neo4j for new entities
  6. Create typed relationships between entities
  7. Mark email as processed
```

**Supported Entity Types:**
- `Person` - Individuals mentioned
- `Organization` - Companies, departments
- `Location` - Geographic locations
- `FinancialTerm` - Financial concepts, trades
- `Project` - Business projects, initiatives
- `EnergyTerm` - Energy-related concepts
- `Regulation` - Regulatory items (FERC, etc.)
- `Event` - Important events, meetings

**Supported Relationships:**
- `communicatedWith` - Email communication
- `worksFor` - Employment relationships
- `locatedIn` - Geographic associations
- `relatedTo` - General semantic links
- `manages` - Management relationships
- (and others extracted by LLM)

### Phase 3: Vector Indexing (Milestone-3.py - one-time)

```
1. Read all emails from Neo4j
2. Split into chunks (500 chars, 50 char overlap)
3. Generate embeddings using multilingual-e5-large
4. Index in Pinecone with metadata
5. Store email chunks for retrieval
```

### Phase 4: Interactive Queries (Milestone-3.py or api.py)

```
For each user question:
  1. Vector Search (Pinecone):
     - Embed user question
     - Find top-5 most similar email chunks

  2. Graph Search (Neo4j):
     - Parse question for entity mentions
     - Query relationship facts from graph
     - Retrieve up to 5 relevant facts

  3. Hybrid Context:
     - Combine graph facts + email snippets
     - Create comprehensive context block

  4. LLM Generation:
     - Send context + question to LLM
     - Generate grounded, factual answer
     - Stream response to user
```

---

## API Endpoints

### `POST /api/query`

Submit a natural language question to the hybrid RAG system.

**Request:**
```json
{
  "query": "Who communicated most about natural gas trading?",
  "top_k": 5
}
```

**Response:**
```json
{
  "answer": "Based on the knowledge graph, John Smith and Jane Doe were the primary communicators about natural gas trading...",
  "sources": [
    {
      "type": "email",
      "snippet": "We discussed natural gas prices in today's meeting...",
      "email_id": "msg_12345"
    },
    {
      "type": "relationship",
      "fact": "John Smith - communicatedWith - Jane Doe"
    }
  ]
}
```

### `GET /api/graph`

Retrieve graph statistics and structure.

**Response:**
```json
{
  "node_count": 1250,
  "relationship_count": 3450,
  "entity_types": ["Person", "Organization", "Location", ...],
  "relationship_types": ["communicatedWith", "worksFor", ...]
}
```

### `GET /`

Serves the React frontend application.

---

## Troubleshooting

### Neo4j Connection Issues

**Error:** `Failed to connect to Neo4j`

**Solution:**
1. Verify `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` in `.env`
2. Ensure Neo4j instance is running (check AuraDB console)
3. Test connection: `neo4j-admin dbms ping` (local) or verify AuraDB status online
4. Check firewall rules and network access

### Pinecone Index Not Found

**Error:** `Index 'email-knowledge-graph' does not exist`

**Solution:**
1. Create index in Pinecone console or use Pinecone CLI
2. Set `PINECONE_INDEX` to match your index name
3. Run vector indexing: uncomment `build_vector_index()` in `MIlestone-3.py`

### LLM API Errors

**Error:** `Invalid LLAMA_API_KEY` or timeout

**Solution:**
1. Verify API key in `.env` (no spaces, correct value)
2. Check Groq/LLAMA service status
3. Ensure rate limits not exceeded
4. Test with simpler queries first

### Out of Memory

**Error:** `MemoryError` during entity extraction

**Solution:**
1. Reduce `BATCH_SIZE` in `Milestone-2.py` (e.g., 5 instead of 10)
2. Reduce `MAX_BODY_CHARS` (e.g., 2500 instead of 3500)
3. Process emails in smaller chunks
4. Increase system RAM or use a more powerful machine

### Missing Dependencies

**Error:** `ModuleNotFoundError`

**Solution:**
```bash
# Reinstall all dependencies
pip install -r requirements.txt --force-reinstall

# Or for specific package
pip install neo4j pandas pinecone langchain-pinecone langchain-groq
```

---

## Example Queries

Try these questions in the interactive interface:

1. **Organizational Structure**
   - "Who worked at Enron?"
   - "What positions did people hold?"

2. **Communication Patterns**
   - "Who communicated most about natural gas trading?"
   - "Which people sent the most emails to each other?"

3. **Regulatory Relationships**
   - "What relationships involve FERC?"
   - "Which people were involved in regulatory matters?"

4. **Business Activities**
   - "What projects were mentioned in emails?"
   - "Who was involved in EnronOnline?"

5. **Relationship Discovery**
   - "How are John Smith and Jane Doe connected?"
   - "What do these two people have in common?"

---

## Development Guide

### Adding New Entity Types

Edit the LLM extraction prompt in `Milestone-2.py`:

```python
EXTRACTION_PROMPT = """
Extract the following entities:
- Person
- Organization
- Location
- FinancialTerm
- Project
- EnergyTerm
- Regulation
- Event
- [NEW_TYPE]  # Add here
"""
```

### Customizing the Frontend

The frontend components are in `frontend/src/components/`:

- Modify `App.tsx` for main layout
- Create new components in `components/`
- Update styles in `styles/` or use Tailwind classes

### Changing the LLM Model

Update in `api.py`, `Milestone-2.py`, or `MIlestone-3.py`:

```python
MODEL_NAME = "your-new-model-name"
```

Supported models (via Groq/OpenRouter):
- `ministral-3:14b` (faster, smaller)
- `gpt-oss:120b-cloud` (more capable)
- `qwen-2.5:72b` (multilingual)

---

## Performance Optimization

**For large datasets:**

1. **Increase Batch Size** (if memory allows): `BATCH_SIZE = 20`
2. **Use Smaller Models**: `ministral-3:14b` instead of larger ones
3. **Parallel Processing**: Run multiple `Milestone-2.py` instances on different email ranges
4. **Database Indexing**: Create Neo4j indexes on frequently queried properties
5. **Caching**: Implement response caching for common queries

---

## Future Enhancements

- [ ] Support for additional data sources (documents, chat logs)
- [ ] Real-time email ingestion and processing
- [ ] Advanced visualization (temporal analysis, network analysis)
- [ ] Custom extraction templates per domain
- [ ] Multi-language support improvements
- [ ] GraphRAG integration for hierarchical reasoning
- [ ] Export knowledge graph to various formats (JSON-LD, RDF)

---

## License

[Your License Here]

---

## Support

For issues, questions, or contributions:
1. Check [Troubleshooting](#troubleshooting) section
2. Review example queries in [Example Queries](#example-queries)
3. Check existing GitHub issues
4. Create a new issue with:
   - Error message and stack trace
   - Steps to reproduce
   - Your environment (Python version, OS, Neo4j version)

---

## Acknowledgments

- Built with [Neo4j](https://neo4j.com/), [Pinecone](https://www.pinecone.io/), and [Groq](https://groq.com/) APIs
- Uses the [Enron Email Dataset](https://www.cs.cmu.edu/~enron/)
- Powered by LangChain and various LLM providers

---

**Last Updated:** March 28, 2025
**Version:** 1.0.0
