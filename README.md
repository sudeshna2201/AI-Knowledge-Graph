# 📧 AI-Based Knowledge Graph Builder for Enterprise Intelligence

A two-milestone AI pipeline built on the **Enron Email Dataset** that:
1. **Milestone 2** — Extracts named entities and relationships from emails and stores them in a **Neo4j** knowledge graph using an LLM.
2. **Milestone 3** — Enables intelligent **Hybrid RAG** (Retrieval-Augmented Generation) search over that graph using **Pinecone** vector search + **Neo4j** graph retrieval + an LLM for grounded, citation-backed answers.

---

## 📁 Project Structure

```
final 2 and 3/
├── Milestone-2.py       # Entity & relationship extraction pipeline (Neo4j ← LLM → Neo4j)
├── MIlestone-3.py       # Hybrid RAG semantic search pipeline (Pinecone + Neo4j + LLM)
├── requirements.txt     # All Python dependencies for both milestones
└── result.txt           # Sample pipeline output / results log
```

---

## 🔧 Prerequisites

- **Python >= 3.10**
- A running **Neo4j** instance (local or AuraDB cloud)
- A **Pinecone** account with an API key
- An **Ollama Cloud (LLAMA) API** key
- An email dataset CSV with columns: `message_id`, `body` (or `body_cleaned`), `subject`

---

## ⚙️ Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Milestone 2
LLAMA_API_KEY=your_llama_api_key_here
NEO4J_URI=neo4j://127.0.0.1:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password_here

# Milestone 3
PINECONE_API_KEY=your_pinecone_api_key_here
```

> ⚠️ **Never commit your `.env` file.** It contains sensitive credentials.

---

## 🚀 Milestone 2 — Knowledge Graph Builder

**File:** `Milestone-2.py`

### What It Does

Runs a fully automated **Neo4j → LLM → Neo4j** pipeline:

1. **Fetches** unprocessed `Email` nodes from Neo4j (those without `entity_extracted = true`).
2. **Preprocesses** each email body — strips headers, footers, email addresses, timestamps, and confidentiality disclaimers.
3. **Sends** the cleaned body to an LLM (`ministral-3:14b` via Ollama Cloud) with a strict extraction prompt.
4. **Parses** the LLM's structured JSON response.
5. **Validates & normalises** all extracted entities and relationships.
6. **Writes** entities as `Entity` nodes and relationships as typed edges back into Neo4j.
7. **Marks** each processed email with `entity_extracted = true` to prevent re-processing.

### Entity Types Extracted

| Type | Example |
|---|---|
| `Person` | `Ken Lay`, `Jeffrey Skilling` |
| `Organization` | `FERC`, `Bank of America` |
| `Location` | `Houston`, `California` |
| `FinancialTerm` | `basis spread`, `ISDA master agreement` |
| `EnergyTerm` | `natural gas`, `megawatt hours` |
| `Project` | `EnronOnline`, `Project Raptor` |
| `Regulation` | `FERC Order 636`, `Sarbanes-Oxley` |
| `Event` | `Global Energy Summit` |

### Neo4j Graph Schema (after Milestone 2)

```
(:Email)-[:HAS_ENTITY]->(:Entity)
(:Entity)-[:<DYNAMIC_RELATIONSHIP>]->(:Entity)
(:Employee)-[:SENT]->(:Email)
(:Employee)-[:RECEIVED]->(:Email)
(:Employee)-[:COMMUNICATES_WITH]->(:Employee)
```

### Key Configuration (top of `Milestone-2.py`)

| Variable | Default | Description |
|---|---|---|
| `BATCH_SIZE` | `10` | Emails per batch fetched from Neo4j |
| `MAX_BODY_CHARS` | `3500` | Max characters sent to LLM per email |
| `MAX_RETRIES` | `2` | LLM retry attempts on JSON parse failure |
| `MODEL_NAME` | `ministral-3:14b` | LLM model used for extraction |

### How to Run

```bash
python Milestone-2.py
```

The pipeline runs continuously until all unprocessed emails in Neo4j are done. It logs progress with entity and relationship counts per email.

### Anti-Hallucination & Data Quality

- The LLM system prompt enforces **strict JSON-only** output with no markdown or prose.
- **Self-correction loop**: If the LLM returns malformed JSON, the error is fed back for automatic correction (up to `MAX_RETRIES` times).
- Post-extraction **garbage filtering** rejects: single-word persons, timezone words as locations, generic stopwords, numeric-only strings, and ubiquitous filler organizations.
- Relationship predicates are **sanitized** to valid Neo4j relationship type names (alphanumeric + underscores, uppercased).

---

## 🔍 Milestone 3 — Hybrid RAG Query Interface

**File:** `MIlestone-3.py`

### What It Does

Provides an **intelligent question-answering interface** over the Enron knowledge graph, combining two retrieval strategies before sending context to an LLM:

| Retrieval | Source | How |
|---|---|---|
| **Vector Search** | Pinecone | Semantic similarity over chunked email bodies |
| **Graph Search** | Neo4j | Structured entity-relationship facts |

The combined context is passed to `gpt-oss:120b-cloud` (via Ollama Cloud) with a **strict anti-hallucination prompt** to produce grounded, cited answers.

### Architecture Overview

```
User Query
    │
    ├──► [Vector Retrieval]  → Pinecone similarity search → top-5 email chunks
    │
    └──► [Graph Retrieval]   → Neo4j Cypher queries       → structured facts
                                  ├── Entity–Entity triples
                                  ├── Employee communication network
                                  ├── Who sent/received emails about entity
                                  └── Who sent the most emails about entity
    │
    └──► [LLM Generation]    → Ollama API (gpt-oss:120b-cloud)
              ↓
          Grounded Answer with citations: (graph fact) / (from email)
```

### Key Configuration (top of `MIlestone-3.py`)

| Variable | Default | Description |
|---|---|---|
| `PINECONE_INDEX` | `email-knowledge-graph` | Pinecone index name |
| `EMBED_MODEL` | `llama-text-embed-v2` | 1024-dim embedding model (Pinecone-hosted) |
| `VECTOR_TOP_K` | `5` | Number of semantic chunks retrieved |
| `GRAPH_FACTS_LIMIT` | `5` | Max Neo4j facts per keyword |
| `CHUNK_SIZE` | `500` | Characters per text chunk for Pinecone indexing |
| `CHUNK_OVERLAP` | `50` | Overlap between consecutive chunks |
| `MODEL_NAME` | `gpt-oss:120b-cloud` | LLM model used for answer generation |

### Step-by-Step Usage

#### Step 1 — System Health Check (runs automatically on startup)
The script runs `run_all_tests()` which validates:
- ✅ Neo4j connection and node counts
- ✅ Pinecone connectivity and index status
- ✅ Embedding model (returns 1024-dim vector)
- ✅ LLM API reachability
- ✅ Vector retrieval returns results
- ✅ Graph retrieval returns facts

#### Step 2 — Build the Pinecone Vector Index (one-time setup)
Edit `EMAIL_CSV` in the script to point to your email CSV, then **uncomment** this line:

```python
# build_vector_index(EMAIL_CSV)
```

The CSV needs these columns: `message_id`, `body` (or `body_cleaned`), `subject`.

Ingestion is **idempotent** — already-uploaded chunks are automatically skipped on re-runs.

#### Step 3 — Query the System

```bash
python MIlestone-3.py
```

You will get an **interactive prompt**:

```
Question: Who are the top executives at Enron and what are their roles?
```

Type `exit` to quit.

### Anti-Hallucination Strategy

The LLM is given these strict rules:
1. Answer **only** from the provided context — no training data.
2. If the context is insufficient, respond: *"The provided context does not contain enough information."*
3. Cite every fact as `(graph fact)` or `(from email)`.
4. `temperature=0` for fully deterministic, reproducible outputs.

### Standalone Semantic Search (Debug Mode)

To inspect raw Pinecone retrieval results without invoking the LLM:

```python
semantic_search("Enron energy trading strategy California")
```

This prints the top-k chunks with their cosine similarity scores and metadata.

---

## 🔄 Full Pipeline — Run Order

```
Step 1: Load Enron emails into Neo4j          (prerequisite — done before this project)
         ↓
Step 2: Run Milestone-2.py                    (extract entities & relationships into Neo4j)
         ↓
Step 3: Run MIlestone-3.py once to ingest     (build Pinecone vector index — one-time)
         emails into Pinecone
         ↓
Step 4: Run MIlestone-3.py for queries        (interactive RAG Q&A)
```

---

## 📦 Dependencies

| Package | Purpose |
|---|---|
| `neo4j>=5.0` | Neo4j Python driver |
| `python-dotenv>=1.0.0` | Load `.env` credentials |
| `requests>=2.28.0` | HTTP calls to LLM API |
| `pinecone>=3.0.0` | Pinecone vector database client |
| `langchain-pinecone>=0.1.0` | LangChain ↔ Pinecone integration |
| `langchain-core>=0.2.0` | LangChain Document abstraction |
| `langchain-text-splitters>=0.2.0` | Recursive text chunking |
| `langchain-groq>=0.1.0` | Groq LLM integration |
| `pandas>=2.0.0` | CSV loading for email dataset |

---

## 🛠️ Troubleshooting

| Issue | Fix |
|---|---|
| `EnvironmentError: NEO4J_PASSWORD` | Set `NEO4J_PASSWORD` in `.env` |
| `EnvironmentError: LLAMA_API_KEY` | Set `LLAMA_API_KEY` in `.env` |
| `Missing env vars: ['PINECONE_API_KEY']` | Set `PINECONE_API_KEY` in `.env` |
| LLM returns malformed JSON | Pipeline auto-retries with error feedback (up to `MAX_RETRIES`) |
| Pinecone index not found | Run `build_vector_index(EMAIL_CSV)` first |
| Vector retrieval returns 0 results | Ensure Pinecone index has been populated; check `EMAIL_CSV` path |
| Neo4j `0 emails remaining` immediately | All emails already processed; reset with `SET m.entity_extracted = null` |

---

## 📊 Example Queries (Milestone 3)

```
Who are the top executives at Enron?
What was discussed about California energy prices?
Which employees communicated most about natural gas trading?
What regulations were mentioned in relation to FERC?
Who sent the most emails about Project Raptor?
```

---

*Built with Neo4j · Pinecone · Ollama Cloud · LangChain · Python 3.10+*
