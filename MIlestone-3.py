# # Milestone 3: Semantic Search & RAG Pipeline
# 
# **Objective**: Enable intelligent, grounded search and retrieval over the Enron email knowledge graph.
# 
# ## Architecture: Hybrid RAG
# - **Vector Search** — Pinecone (`llama-text-embed-v2`, 1024-dim) for semantic email retrieval
# - **Graph Search** — Neo4j entity-relationship triples for structured facts
# - **Generation** — Groq (`llama-3.3-70b-versatile`) with strict anti-hallucination prompting
# 
# ## Anti-Hallucination Strategy
# - LLM is instructed to answer **only from provided context**
# - If context is insufficient, it says so explicitly — no fabrication
# - `temperature=0` for deterministic, grounded outputs
# - Retrieved context is clearly labeled (Graph Facts vs. Email Snippets)

# ## 1. Setup & Configuration

import os
import re
import time
import pandas as pd
from dotenv import load_dotenv

from neo4j import GraphDatabase
from pinecone import Pinecone, ServerlessSpec

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_pinecone import PineconeVectorStore, PineconeEmbeddings
import requests

load_dotenv(override=True)

# ── Credentials ──────────────────────────────────────────────────────────────
PINECONE_API_KEY  = os.getenv("PINECONE_API_KEY")
LLAMA_API_KEY     = os.getenv("LLAMA_API_KEY")
NEO4J_URI         = os.getenv("NEO4J_URI",      "bolt://localhost:7687")
NEO4J_USER        = os.getenv("NEO4J_USER",     os.getenv("NEO4J_USERNAME", "neo4j"))
NEO4J_PASSWORD    = os.getenv("NEO4J_PASSWORD")

# ── Pinecone / Embedding settings ────────────────────────────────────────────
PINECONE_INDEX    = "email-knowledge-graph"   # reuse from reference
EMBED_MODEL       = "llama-text-embed-v2"     # 1024-dim, hosted on Pinecone
EMBED_DIM         = 1024

# ── LLM settings ─────────────────────────────────────────────────────────────
OPENROUTER_URL    = "https://ollama.com/v1/chat/completions"
MODEL_NAME        = "gpt-oss:120b-cloud"

# ── Retrieval settings ───────────────────────────────────────────────────────
VECTOR_TOP_K      = 5    # semantic chunks to retrieve
GRAPH_FACTS_LIMIT = 5    # facts per keyword from Neo4j
CHUNK_SIZE        = 500
CHUNK_OVERLAP     = 50

# Validate required keys
missing = [k for k, v in {
    "PINECONE_API_KEY": PINECONE_API_KEY,
    "LLAMA_API_KEY":    LLAMA_API_KEY,
    "NEO4J_PASSWORD":   NEO4J_PASSWORD,
}.items() if not v]
if missing:
    raise EnvironmentError(f"Missing env vars: {missing}. Add them to .env")

print("✅ Config loaded")

# ## 1b. System Health Checks

def test_neo4j():
    """Test Neo4j local connection is alive and reachable."""
    print("\n── Test: Neo4j ─────────────────────────────────────────")
    try:
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        with driver.session() as session:
            result = session.run("RETURN 'Neo4j connection OK' AS msg")
            msg = result.single()["msg"]
            print(f"  ✅ {msg}")
            # Check node counts
            counts = session.run("""
                MATCH (e:Email)    WITH count(e) AS emails
                MATCH (en:Entity)  WITH emails, count(en) AS entities
                OPTIONAL MATCH (emp:Employee) WITH emails, entities, count(emp) AS employees
                RETURN emails, entities, employees
            """)
            row = counts.single()
            print(f"  📊 Email nodes    : {row['emails']}")
            print(f"  📊 Entity nodes   : {row['entities']}")
            print(f"  📊 Employee nodes : {row['employees']}")
    except Exception as e:
        print(f"  ❌ Neo4j FAILED: {e}")
    finally:
        driver.close()


def test_pinecone():
    """Test Pinecone API key is valid and index is accessible."""
    print("\n── Test: Pinecone ──────────────────────────────────────")
    try:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        indexes = pc.list_indexes().names()
        print(f"  ✅ Pinecone connected. Available indexes: {list(indexes)}")
        if PINECONE_INDEX in indexes:
            idx = pc.Index(PINECONE_INDEX)
            stats = idx.describe_index_stats()
            print(f"  📊 Index '{PINECONE_INDEX}' — total vectors: {stats['total_vector_count']}")
        else:
            print(f"  ⚠️  Index '{PINECONE_INDEX}' not found yet (run build_vector_index first)")
    except Exception as e:
        print(f"  ❌ Pinecone FAILED: {e}")


def test_embedding_model():
    """Test Pinecone embedding model returns a valid 1024-dim vector."""
    print("\n── Test: Embedding Model ───────────────────────────────")
    try:
        embeddings = PineconeEmbeddings(model=EMBED_MODEL)
        vector = embeddings.embed_query("test embedding for Enron RAG pipeline")
        assert len(vector) == EMBED_DIM, f"Expected {EMBED_DIM} dims, got {len(vector)}"
        print(f"  ✅ Embedding model '{EMBED_MODEL}' working — vector dim: {len(vector)}")
    except Exception as e:
        print(f"  ❌ Embedding model FAILED: {e}")


def test_llm():
    """Test Ollama API key is valid and model responds."""
    print("\n── Test: LLM (Ollama API) ──────────────────────────────")
    try:
        headers = {"Authorization": f"Bearer {LLAMA_API_KEY}", "Content-Type": "application/json"}
        payload = {
            "model": MODEL_NAME,
            "messages": [{"role": "user", "content": "Reply with exactly: LLM connection OK"}],
            "temperature": 0,
        }
        response = requests.post(OPENROUTER_URL, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        reply = response.json()["choices"][0]["message"]["content"]
        print(f"  ✅ LLM '{MODEL_NAME}' responded: {reply.strip()}")
    except Exception as e:
        print(f"  ❌ LLM FAILED: {e}")


def test_vector_retrieval():
    """Test that Pinecone vector search returns results for a sample query."""
    print("\n── Test: Vector Retrieval ──────────────────────────────")
    try:
        embeddings = PineconeEmbeddings(model=EMBED_MODEL)
        vs = PineconeVectorStore(index_name=PINECONE_INDEX, embedding=embeddings)
        results = vs.similarity_search("Enron energy trading", k=1)
        if results:
            print(f"  ✅ Vector retrieval working — got {len(results)} result(s)")
            print(f"  📄 Sample: {results[0].page_content[:100]}...")
        else:
            print("  ⚠️  Vector retrieval returned 0 results (index may be empty)")
    except Exception as e:
        print(f"  ❌ Vector retrieval FAILED: {e}")


def test_graph_retrieval():
    """Test that Neo4j graph retrieval returns facts for a known keyword."""
    print("\n── Test: Graph Retrieval ───────────────────────────────")
    try:
        facts = retrieve_graph("Enron")
        if facts:
            print(f"  ✅ Graph retrieval working — got {len(facts)} fact(s)")
            print(f"  📄 Sample: {facts[0]}")
        else:
            print("  ⚠️  Graph retrieval returned 0 facts (graph may be empty)")
    except Exception as e:
        print(f"  ❌ Graph retrieval FAILED: {e}")


def run_all_tests():
    """Run all system health checks and print a final summary."""
    print("\n" + "=" * 60)
    print("  🧪 RUNNING SYSTEM HEALTH CHECKS")
    print("=" * 60)
    test_neo4j()
    test_pinecone()
    test_embedding_model()
    test_llm()
    test_vector_retrieval()
    test_graph_retrieval()
    print("\n" + "=" * 60)
    print("  ✅ ALL TESTS COMPLETE")
    print("=" * 60 + "\n")

# ## 2. Pinecone Index & Embedding Model

def get_pinecone_index():
    """Create the Pinecone index if it doesn't exist, return the index object."""
    pc = Pinecone(api_key=PINECONE_API_KEY)
    if PINECONE_INDEX not in pc.list_indexes().names():
        print(f"Creating Pinecone index '{PINECONE_INDEX}'...")
        pc.create_index(
            name=PINECONE_INDEX,
            dimension=EMBED_DIM,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )
        while not pc.describe_index(PINECONE_INDEX).status["ready"]:
            time.sleep(1)
        print("✅ Index created")
    return pc.Index(PINECONE_INDEX)


def get_embeddings():
    """Return the Pinecone-hosted embedding model."""
    return PineconeEmbeddings(model=EMBED_MODEL)


def get_vectorstore():
    """Return a LangChain PineconeVectorStore backed by the embedding model."""
    return PineconeVectorStore(index_name=PINECONE_INDEX, embedding=get_embeddings())


def safe_id(text: str) -> str:
    """Make a Pinecone-safe ASCII ID from arbitrary text."""
    clean = text.encode("ascii", "ignore").decode()
    return re.sub(r"[^a-zA-Z0-9\-_]", "_", clean)


print("✅ Pinecone helpers ready")

# ## 3. Build — Ingest Emails into Pinecone
# 
# Reads a CSV with `message_id`, `body` (or `body_cleaned`), and `subject` columns.  
# Chunks each email body, deduplicates via `index.fetch()`, then uploads in batches of 100.

def build_vector_index(email_csv: str):
    """Ingest emails from a CSV file into the Pinecone vector index.

    Args:
        email_csv: Path to CSV containing email data.
    """
    if not os.path.exists(email_csv):
        raise FileNotFoundError(f"CSV not found: {email_csv}")

    index      = get_pinecone_index()
    embeddings = get_embeddings()
    splitter   = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP
    )

    df = pd.read_csv(email_csv)
    print(f"Loading {len(df)} emails from {email_csv}...")

    docs, doc_ids = [], []
    for _, row in df.iterrows():
        body = str(row.get("body_cleaned", row.get("body", "")))
        if not body or body.lower() == "nan":
            continue
        msg_id   = str(row["message_id"])
        metadata = {
            "message_id": msg_id,
            "subject":    str(row.get("subject", "")),
            "source":     "email",
        }
        for i, chunk in enumerate(splitter.split_text(body)):
            docs.append(Document(page_content=chunk, metadata=metadata))
            doc_ids.append(f"email_{safe_id(msg_id)}_{i}")

    if not docs:
        print("⚠️  No usable email bodies found.")
        return

    print(f"Uploading {len(docs)} chunks (batch=100, dedup enabled)...")
    batch_size = 100
    for i in range(0, len(docs), batch_size):
        b_docs = docs[i : i + batch_size]
        b_ids  = doc_ids[i : i + batch_size]

        # Idempotency: skip already-uploaded chunks
        try:
            existing = set(index.fetch(ids=b_ids).vectors.keys())
        except Exception:
            existing = set()

        new_docs = [d for d, did in zip(b_docs, b_ids) if did not in existing]
        new_ids  = [did for did in b_ids if did not in existing]

        end = min(i + batch_size, len(docs))
        if new_docs:
            print(f"  [{end}/{len(docs)}] uploading {len(new_docs)} new chunks")
            vs = PineconeVectorStore(index_name=PINECONE_INDEX, embedding=embeddings)
            vs.add_documents(new_docs, ids=new_ids)
        else:
            print(f"  [{end}/{len(docs)}] all exist, skipped")

    print(f"✅ Vector index ready: '{PINECONE_INDEX}'")


print("✅ build_vector_index() ready")

# ## 4. Retrieve — Hybrid Search (Vector + Graph)

def retrieve_vector(query: str, top_k: int = VECTOR_TOP_K) -> list[str]:
    """Semantic vector search — returns the top-k email text snippets."""
    vs     = get_vectorstore()
    result = vs.similarity_search(query, k=top_k)
    return [doc.page_content for doc in result]


# ── Graph NLP stopwords ──────────────────────────────────────────────────────
GRAPH_STOPWORDS = {
    "what", "which", "where", "when", "who", "whom", "whose",
    "have", "does", "their", "about", "with", "from", "that",
    "this", "were", "been", "being", "most", "more", "many",
    "some", "ever", "mention", "mentioned", "sent", "received",
    "email", "emails", "communicated", "said", "saying", "related",
    "during", "tone", "context", "anywhere", "then", "know",
    "before", "raise", "raised", "internal", "both", "also",
    "there", "those", "these", "they", "them", "than", "only",
    "just", "into", "onto", "over", "under", "after", "between",
}


def extract_keywords(query: str) -> list[str]:
    """Extract meaningful keywords from query — filters stopwords and short words."""
    words = re.sub(r"[^a-zA-Z0-9\s]", " ", query).split()
    keywords = [
        w.strip() for w in words
        if len(w) > 3 and w.lower() not in GRAPH_STOPWORDS
    ]
    return list(dict.fromkeys(keywords))  # deduplicate, preserve order


def retrieve_graph(query: str) -> list[str]:
    """Graph retrieval — returns structured entity-relationship facts from Neo4j.

    Searches for keywords (words > 3 chars) in entity names and returns the
    relationships those entities participate in.
    """
    driver   = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    keywords = extract_keywords(query)
    facts    = set()

    try:
        with driver.session() as session:
            for kw in keywords:
                # Entity-entity triples extracted by Milestone 2
                rows = session.run(
                    """
                    MATCH (n:Entity)
                    WHERE toLower(n.name) CONTAINS toLower($kw)
                    MATCH (n)-[r]->(t:Entity)
                    WHERE type(r) <> 'MENTIONS'
                    RETURN n.name AS src, type(r) AS rel, t.name AS tgt
                    LIMIT $limit
                    """,
                    kw=kw,
                    limit=GRAPH_FACTS_LIMIT,
                )
                for r in rows:
                    facts.add(f"{r['src']} [{r['rel']}] {r['tgt']}")

                # Reverse direction too
                rows2 = session.run(
                    """
                    MATCH (n:Entity)
                    WHERE toLower(n.name) CONTAINS toLower($kw)
                    MATCH (src:Entity)-[r]->(n)
                    WHERE type(r) <> 'MENTIONS'
                    RETURN src.name AS src, type(r) AS rel, n.name AS tgt
                    LIMIT $limit
                    """,
                    kw=kw,
                    limit=GRAPH_FACTS_LIMIT,
                )
                for r in rows2:
                    facts.add(f"{r['src']} [{r['rel']}] {r['tgt']}")

                # Communication Network (Employee-Employee with frequency)
                rows3 = session.run(
                    """
                    MATCH (e:Employee)
                    WHERE toLower(e.name) CONTAINS toLower($kw) OR toLower(e.email) CONTAINS toLower($kw)
                    MATCH (e)-[r:COMMUNICATES_WITH]->(other:Employee)
                    RETURN e.name AS src, type(r) AS rel, other.name AS tgt, r.frequency AS freq
                    ORDER BY r.frequency DESC LIMIT $limit
                    """,
                    kw=kw,
                    limit=GRAPH_FACTS_LIMIT,
                )
                for r in rows3:
                    facts.add(f"{r['src']} [{r['rel']} x{r['freq']}] {r['tgt']}")

                # Who SENT emails mentioning this entity
                rows4 = session.run(
                    """
                    MATCH (emp:Employee)-[:SENT]->(e:Email)-[:HAS_ENTITY]->(en:Entity)
                    WHERE toLower(en.name) CONTAINS toLower($kw)
                    RETURN DISTINCT emp.name AS sender, en.name AS entity
                    LIMIT $limit
                    """,
                    kw=kw,
                    limit=GRAPH_FACTS_LIMIT,
                )
                for r in rows4:
                    facts.add(f"{r['sender']} [MENTIONED] {r['entity']}")

                # Who RECEIVED emails mentioning this entity
                rows5 = session.run(
                    """
                    MATCH (emp:Employee)-[:RECEIVED]->(e:Email)-[:HAS_ENTITY]->(en:Entity)
                    WHERE toLower(en.name) CONTAINS toLower($kw)
                    RETURN DISTINCT emp.name AS sender, en.name AS entity
                    LIMIT $limit
                    """,
                    kw=kw,
                    limit=GRAPH_FACTS_LIMIT,
                )
                for r in rows5:
                    facts.add(f"{r['sender']} [RECEIVED_EMAIL_ABOUT] {r['entity']}")

                # Aggregation — who sent the most emails mentioning this entity
                rows6 = session.run(
                    """
                    MATCH (emp:Employee)-[:SENT]->(e:Email)-[:HAS_ENTITY]->(en:Entity)
                    WHERE toLower(en.name) CONTAINS toLower($kw)
                    RETURN emp.name AS sender, count(e) AS email_count
                    ORDER BY email_count DESC
                    LIMIT $limit
                    """,
                    kw=kw,
                    limit=GRAPH_FACTS_LIMIT,
                )
                for r in rows6:
                    facts.add(f"{r['sender']} [SENT_MOST_EMAILS_ABOUT] {r['entity'] if 'entity' in r else kw} (count: {r['email_count']})")
    except Exception as e:
        print(f"⚠️  Graph retrieval error: {e}")
    finally:
        driver.close()

    return list(facts)


def retrieve_hybrid(query: str) -> str:
    """Merge graph facts and vector snippets into a single context block."""
    graph_facts   = retrieve_graph(query)
    vector_chunks = retrieve_vector(query)

    graph_section  = "\n".join(f"- {f}" for f in graph_facts) or "(none found)"
    vector_section = "\n".join(f"- {c}" for c in vector_chunks) or "(none found)"

    return (
        f"=== GRAPH FACTS (structured, from knowledge graph) ===\n{graph_section}\n\n"
        f"=== EMAIL SNIPPETS (semantic, from Pinecone) ===\n{vector_section}"
    )


print("✅ Retrieval functions ready")

# ## 5. Generate — Anti-Hallucination RAG Answer
# 
# **Prompt engineering principles applied:**
# 1. **Strict grounding** — model is explicitly told to use only the provided context
# 2. **Explicit fallback** — model must say `"I don't know"` if context is insufficient
# 3. **Source attribution** — model must cite whether facts are from Graph or Email Snippets
# 4. **Temperature = 0** — deterministic, no creative hallucination
# 5. **No injection** — user query goes into `{question}`, context into `{context}`, fully separated

# ── Anti-Hallucination System Prompt ─────────────────────────────────────────
SYSTEM_PROMPT = """You are an Enterprise Intelligence Assistant for the Enron email dataset.
Your ONLY source of truth is the context provided below.

STRICT RULES:
1. Answer using ONLY the information in the context. Do NOT add any information from your training data.
2. If the context does not contain the answer, respond with:
   "The provided context does not contain enough information to answer this question."
3. When you use a fact from GRAPH FACTS, say "(graph fact)" after it.
4. When you use information from EMAIL SNIPPETS, say "(from email)" after it.
5. Never speculate, guess, or fill gaps with general knowledge.
6. Be concise and direct."""

HUMAN_TEMPLATE = """Context:
{context}

Question: {question}

Answer (use only the context above):"""


def generate_answer(question: str) -> str:
    """Run hybrid retrieval then generate a grounded, cited answer.

    Args:
        question: Natural language query from the user.

    Returns:
        A grounded answer string, or an explicit "not enough context" response.
    """
    print(f"\n🔍 Query: {question}")

    context = retrieve_hybrid(question)

    headers = {"Authorization": f"Bearer {LLAMA_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": HUMAN_TEMPLATE.format(context=context, question=question)},
        ],
        "temperature": 0,       # zero temperature = no hallucination drift
    }
    response = requests.post(OPENROUTER_URL, headers=headers, json=payload, timeout=120)
    response.raise_for_status()
    answer = response.json()["choices"][0]["message"]["content"]

    return answer


print("✅ generate_answer() ready")

# ## 6. System Health Checks
# All functions are now defined — safe to run tests here.
run_all_tests()

# ## 8. Build the Vector Index
# 
# **Run once** to ingest emails into Pinecone. Safe to re-run — already-indexed chunks are skipped.
# 
# Point `EMAIL_CSV` to your email dataset CSV (needs `message_id` + `body` or `body_cleaned` columns).

# ── Set path to your email CSV ────────────────────────────────────────────────
EMAIL_CSV = "../m2/AI-based-Knowledge-Graph-Builder-for-Enterprise-Intelligence-main/sample_email_by_category/sample_email.csv"

# Uncomment to build the vector index:
# build_vector_index(EMAIL_CSV)

print("ℹ️  Uncomment the line above to ingest emails into Pinecone.")

# ## 9. Query the RAG System
# 
# Run a single query or use the interactive loop below.

# ── Single query example ──────────────────────────────────────────────────────
answer = generate_answer("Who are the top executives at Enron and what are their roles?")
print("\n" + "=" * 60)
print("ANSWER:")
print(answer)
print("=" * 60)

# ── Interactive query loop ────────────────────────────────────────────────────
print("=== Enterprise Knowledge Graph — RAG Query Interface ===")
print("Type 'exit' to quit.\n")

while True:
    q = input("Question: ").strip()
    if not q:
        continue
    if q.lower() == "exit":
        print("Goodbye!")
        break
    answer = generate_answer(q)
    print(f"\nAnswer:\n{answer}")
    print("-" * 60)

# ## 10. Semantic Search (standalone, no LLM)
# 
# Use this to inspect raw retrieval results before generation — useful for debugging.

def semantic_search(query: str, top_k: int = VECTOR_TOP_K):
    """Run semantic search and print retrieved chunks with metadata."""
    vs   = get_vectorstore()
    docs = vs.similarity_search_with_score(query, k=top_k)

    print(f"Top {top_k} results for: '{query}'\n" + "-" * 60)
    for i, (doc, score) in enumerate(docs, 1):
        print(f"[{i}] Score: {score:.4f} | msg_id: {doc.metadata.get('message_id', 'N/A')}")
        print(f"     Subject: {doc.metadata.get('subject', 'N/A')}")
        print(f"     {doc.page_content[:200]}...\n")


# Example:
# semantic_search("Enron energy trading strategy California")