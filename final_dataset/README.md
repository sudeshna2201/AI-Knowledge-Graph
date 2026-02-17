# Enron Email Dataset - Final Processed Results

## Overview

This directory contains the final preprocessed and enriched Enron email dataset. The pipeline has processed **517,401 raw email records** into **47,365 clean emails** from **7,415 employees**, generating **70,580 communication relationships** and **14,772 aggregated communication edges**.

---

## Dataset Summary

### Processing Statistics

| Metric | Count |
|--------|-------|
| **Raw Records Loaded** | 517,401 |
| **Valid Emails (after cleaning)** | 47,365 |
| **Unique Employees** | 7,415 |
| **Total Communications** | 70,580 |
| **Aggregated Edges** | 14,772 |
| **Internal Communications** | 48,517 (68.7%) |
| **External Communications** | 22,063 (31.3%) |

### Temporal Coverage

- **Date Range**: May 1, 1997 to May 31, 2002
- **Boundary Validation**: All emails fall within 1995-2005 range
- **Average Email Length**: 1,720.86 characters
- **Average Word Count**: 247.82 words

---

## Dataset Files

### 1. `employees.csv` (595 KB)
**7,415 employee records**

#### Columns:
- `employee_id`: Unique 16-character hash identifier
- `email_address`: Employee email address
- `employee_name`: Extracted from X-From/X-To headers
- `emails_sent_count`: Total emails sent by employee
- `emails_received_count`: Total emails received
- `unique_contacts_count`: Total unique people communicated with
- `internal_contacts_sent`: Unique internal (@enron.com) contacts
- `external_contacts_sent`: Unique external (non-Enron) contacts

#### Sample Records:
```
employee_id,email_address,employee_name,emails_sent_count,emails_received_count,unique_contacts_count
012e50ad4c9147bd,adam.johnson@enron.com,"Johnson, Adam",65,1,17
b0028fc1119cd7de,andy.zipper@enron.com,"Zipper, Andy",69,264,114
0cfef415b47c1d39,a..martin@enron.com,"Martin, Thomas A.",42,28,46
```

---

### 2. `emails.csv` (358 MB)
**47,365 email records with layered cleaning**

#### Columns:
- `message_id`: Unique email identifier
- `timestamp`: Email send date/time
- `sender`: Sender email address (from)
- `to`: Primary recipients
- `subject`: Email subject line
- `body_raw`: Original unprocessed email body
- `body_stage1`: After removing forwarded/original message blocks
- `body_stage2`: After removing quoted replies and signatures
- `body_cleaned`: Final cleaned version
- `year`, `month`, `day`, `hour`, `weekday`: Temporal features

#### Data Lineage:
The dataset preserves **3 intermediate cleaning stages** plus the raw body:
1. **Raw** → **Stage 1**: Remove forwarded message blocks
2. **Stage 1** → **Stage 2**: Remove quoted replies (lines starting with '>')
3. **Stage 2** → **Cleaned**: Normalize whitespace

---

### 3. `communications.csv` (8.8 MB)
**70,580 individual communication records**

#### Columns:
- `sender_email`: Email sender
- `receiver_email`: Email receiver (includes To, CC, BCC)
- `message_id`: Reference to source email
- `timestamp`: Communication timestamp
- `communication_frequency`: Number of emails in this direction
- `communication_type`: `internal` or `external`

#### Classification Logic:
- **Internal**: Both sender and receiver have `@enron.com` domain
- **External**: Either party has non-Enron domain

#### Sample Records:
```
sender_email,receiver_email,message_id,timestamp,communication_type
adam.johnson@enron.com,john.arnold@enron.com,<msg123>,2001-05-04 13:51:18,internal
andy.zipper@enron.com,greg.piper@enron.com,<msg456>,2001-05-23 16:35:04,internal
```

---

### 4. `aggregated_communications.csv` (1.4 MB) **[NEW]**
**14,772 aggregated communication edges**

#### Columns:
- `sender_email`: Email sender
- `receiver_email`: Email receiver
- `first_contact`: Timestamp of first communication
- `last_contact`: Timestamp of most recent communication
- `communication_frequency`: Total number of emails sent
- `communication_type`: `internal` or `external`
- `temporal_span_days`: Duration of relationship in days

#### Use Cases:
- Network analysis of communication patterns
- Identifying key relationships by frequency
- Temporal evolution of professional networks

#### Sample Records:
```
sender_email,receiver_email,first_contact,last_contact,frequency,temporal_span_days
adam.johnson@enron.com,john.arnold@enron.com,2001-05-04 13:51:18,2001-05-31 22:21:59,41,27
andy.zipper@enron.com,greg.piper@enron.com,2001-05-23 16:35:04,2001-05-29 16:54:07,11,6
```

---

### 5. `email_enrichment_features.csv` (3.0 MB)
**47,365 records with analytical features**

#### Columns:
- `message_id`: Email identifier
- `email_length`: Character count of cleaned body
- `word_count`: Word count of cleaned body
- `communication_time_category`: Time of day classification
  - `Morning` (5am-12pm)
  - `Afternoon` (12pm-5pm)
  - `Evening` (5pm-9pm)
  - `Night` (9pm-5am)

---

### 6. `employee_metrics.csv` (565 KB) **[NEW]**
**7,415 employee-level communication metrics**

#### Columns:
- `employee_id`: Unique employee identifier
- `email_address`: Employee email
- `employee_name`: Extracted name
- `emails_sent_count`: Total emails sent
- `emails_received_count`: Total emails received
- `unique_contacts_count`: Total unique contacts
- `internal_contacts_sent`: Unique internal contacts
- `external_contacts_sent`: Unique external contacts

#### Sample Records:
```
employee_id,email_address,emails_sent,emails_received,unique_contacts,internal_contacts,external_contacts
012e50ad4c9147bd,adam.johnson@enron.com,65,1,17,16,0
b0028fc1119cd7de,andy.zipper@enron.com,69,264,114,33,7
0cfef415b47c1d39,a..martin@enron.com,42,28,46,24,1
```

---

## Key Features Implemented

### ✓ 1. Timestamp Boundary Validation
- Enforced 1995-2005 date range
- Removed 2 emails outside boundaries
- All 47,365 emails validated

### ✓ 2. Extended Communication Extraction
- Captures To, CC (X-cc), and BCC (X-bcc) recipients
- 70,580 total communication records
- Full recipient coverage

### ✓ 3. Aggregated Communication Edges
- 14,772 unique sender-receiver pairs
- Includes frequency and temporal span
- Enables network analysis

### ✓ 4. Employee Name Extraction
- Extracted from X-From and X-To headers
- 7,415 employees with names
- Format: `"Last, First <email>"`

### ✓ 5. Layered Email Body Cleaning
- **3 cleaning stages** preserved
- Maintains data lineage
- Enables analysis at different granularities

### ✓ 6. Internal/External Classification
- Domain-based classification
- 68.7% internal, 31.3% external
- Applied to all communications

### ✓ 7. Employee-Level Metrics
- Sent/received counts
- Unique contact tracking
- Internal vs external breakdown

---

## Entity Descriptions

### Employee Entity
Represents a unique email address in the dataset. Each employee has:
- **Identifier**: MD5 hash (first 16 chars) of email address
- **Name**: Extracted from email headers when available
- **Metrics**: Communication statistics and contact counts

### Email Entity
Represents a single email message with:
- **Unique ID**: Message-ID from email headers
- **Temporal Data**: Timestamp and derived features (year, month, day, hour, weekday)
- **Content**: Subject and body (raw + 3 cleaning stages)
- **Metadata**: Sender, recipients, length, word count

### Communication Entity
Represents a directed communication from sender to receiver:
- **Direction**: One-way relationship (sender → receiver)
- **Type**: Internal or external classification
- **Frequency**: Number of emails in this direction
- **Temporal**: Timestamp of communication

### Aggregated Edge Entity
Represents the cumulative relationship between two people:
- **Frequency**: Total emails sent from sender to receiver
- **Temporal Span**: Duration of relationship
- **First/Last Contact**: Relationship timeline
- **Type**: Internal or external classification

---

## Data Quality

### Validation Results
✓ No duplicate Message-IDs  
✓ All email addresses valid (regex validated)  
✓ No null timestamps  
✓ All emails within 1995-2005 range  
✓ Aggregated communications dataset complete  
✓ Employee names extracted for all 7,415 employees  
✓ All layered cleaning stages present  
✓ Communication types valid (internal/external only)  
✓ Employee metrics complete  

### Data Integrity
- **Referential Integrity**: All communications reference valid employees
- **Deterministic Processing**: Reproducible results with same input
- **Data Lineage**: Raw and intermediate data preserved

---

## Use Cases

### Network Analysis
- Use `aggregated_communications.csv` for relationship networks
- Analyze communication frequency and temporal patterns
- Identify key connectors and communication hubs

### Text Analysis
- Use layered cleaning stages for different analysis depths
- `body_stage1`: Remove forwarding artifacts
- `body_stage2`: Remove conversational noise
- `body_cleaned`: Final clean text for NLP

### Temporal Analysis
- Track communication patterns over time
- Analyze temporal spans of relationships
- Study communication time preferences

### Employee Analytics
- Identify most active communicators
- Analyze internal vs external communication patterns
- Study network centrality and influence

---

## Technical Details

### Processing Pipeline
1. **Load**: 517,401 raw records
2. **Parse**: Extract headers and body
3. **Clean**: Remove duplicates, validate timestamps, layered body cleaning
4. **Extract**: Create communication relationships (To, CC, BCC)
5. **Aggregate**: Group communications by sender-receiver pairs
6. **Entities**: Create employee records with names
7. **Metrics**: Compute employee-level statistics
8. **Enrich**: Add analytical features
9. **Validate**: Comprehensive data quality checks
10. **Export**: 6 CSV files to `final_dataset/`

### Data Retention
- **Removed**: 470,036 records (duplicates, invalid dates, malformed data)
- **Retained**: 47,365 clean emails (9.2% of raw data)
- **Quality over Quantity**: Strict validation ensures high-quality dataset

---

## Citation

If you use this dataset, please cite:
```
Enron Email Dataset - Preprocessed and Enriched
Processed: 2026-02-12
Original Source: Enron Corporation Email Archive
Processing Pipeline: Enhanced Enron Preprocessing Pipeline v2.0
```

---

## Contact

For questions about this dataset or the preprocessing pipeline, please refer to the source code documentation in `enron_preprocessing_pipeline.py`.
