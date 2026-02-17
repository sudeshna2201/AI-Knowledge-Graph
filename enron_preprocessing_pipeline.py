

import pandas as pd
import re
import logging
import os
import hashlib
from datetime import datetime
from typing import Dict
import nltk
from nltk.corpus import stopwords

# Download stopwords
try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords', quiet=True)


class EnronPreprocessor:
    """Production-quality email preprocessing pipeline."""
    
    def __init__(self, input_csv: str, output_dir: str = "final_dataset"):
        self.input_csv = input_csv
        self.output_dir = output_dir
        self.email_pattern = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
        self.stopwords = set(stopwords.words('english'))
        self._setup_logging()
        
    def _setup_logging(self):
        logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
        self.logger = logging.getLogger(__name__)
    
    def _extract_field(self, headers: str, field: str) -> str:
        """Extract email header field."""
        match = re.search(rf'^{field}:\s*(.+?)$', headers, re.MULTILINE | re.IGNORECASE)
        return match.group(1).strip() if match else ""
    
    def load_data(self):
        """Load raw CSV with multi-encoding support."""
        self.logger.info("Loading dataset...")
        for encoding in ['utf-8', 'latin-1', 'iso-8859-1', 'cp1252']:
            try:
                self.df = pd.read_csv(self.input_csv, encoding=encoding, low_memory=False)
                self.logger.info(f"Loaded {len(self.df):,} records")
                return self
            except UnicodeDecodeError:
                continue
        raise ValueError("Failed to load dataset")
    
    def parse_emails(self):
        """Parse email headers and body."""
        self.logger.info("Parsing emails...")
        
        # Split headers and body
        parsed = self.df['message'].str.split('\n\n', n=1, expand=True)
        headers, body = parsed[0].fillna(''), parsed[1].fillna('')
        
        # Extract all header fields
        fields = ['Message-ID', 'Date', 'From', 'To', 'Subject', 'X-cc', 'X-bcc', 'X-From', 'X-To']
        for field in fields:
            self.df[field.lower().replace('-', '_')] = headers.apply(lambda x: self._extract_field(x, field))
        
        self.df['body_raw'] = body
        self.logger.info(f"Parsed {len(self.df):,} emails")
        return self
    
    def clean_data(self):
        """Clean and normalize data."""
        self.logger.info("Cleaning data...")
        initial = len(self.df)
        
        # Remove duplicates and invalid records
        self.df = self.df.drop_duplicates(subset=['message_id'], keep='first')
        self.df = self.df[(self.df['from'].notna()) & (self.df['from'] != '') & 
                          (self.df['date'].notna()) & (self.df['date'] != '')]
        
        # Fill missing values and normalize
        self.df['subject'] = self.df['subject'].fillna("No Subject").replace('', "No Subject")
        self.df['body_raw'] = self.df['body_raw'].fillna("")
        self.df['from'] = self.df['from'].str.lower().str.strip()
        self.df = self.df[self.df['from'].str.match(self.email_pattern)]
        
        # Process timestamps with boundary validation
        self.df['date'] = self.df['date'].str.replace(r'\s*\([A-Z]{3,4}\)\s*$', '', regex=True)
        self.df['timestamp'] = pd.to_datetime(self.df['date'], errors='coerce', utc=True).dt.tz_localize(None)
        self.df = self.df[self.df['timestamp'].notna()]
        self.df = self.df[(self.df['timestamp'] >= pd.Timestamp('1995-01-01')) &
                          (self.df['timestamp'] <= pd.Timestamp('2005-12-31'))]
        
        # Extract temporal features
        for feat in ['year', 'month', 'day', 'hour', 'weekday']:
            self.df[feat] = getattr(self.df['timestamp'].dt, feat)
        
        # Layered body cleaning
        cleaning_patterns = [
            (r'-+\s*Original Message\s*-+.*$', ''),
            (r'-+\s*Forwarded by.*?-+', ''),
        ]
        
        self.df['body_stage1'] = self.df['body_raw'].apply(
            lambda x: re.sub(cleaning_patterns[0][0], '', str(x), flags=re.DOTALL | re.IGNORECASE).strip() if x else ""
        )
        self.df['body_stage2'] = self.df['body_stage1'].apply(
            lambda x: '\n'.join([l for l in str(x).split('\n') if not l.strip().startswith('>')]).strip() if x else ""
        )
        self.df['body_cleaned'] = self.df['body_stage2'].apply(
            lambda x: re.sub(r'\n{3,}', '\n\n', str(x)).strip() if x else ""
        )
        
        self.logger.info(f"Cleaned to {len(self.df):,} emails (removed {initial - len(self.df):,})")
        return self
    
    def extract_relationships(self):
        """Extract communication relationships with classification."""
        self.logger.info("Extracting relationships...")
        
        comms = []
        for _, row in self.df.iterrows():
            sender = row['from']
            sender_domain = sender.split('@')[-1] if '@' in sender else ''
            
            # Parse all recipients
            recipients = []
            for field in ['to', 'x_cc', 'x_bcc']:
                if pd.notna(row[field]) and row[field]:
                    recipients.extend([r.strip().lower() for r in re.split(r'[,;]', row[field])])
            
            # Create classified relationships
            for recipient in recipients:
                if self.email_pattern.match(recipient) and recipient != sender:
                    receiver_domain = recipient.split('@')[-1] if '@' in recipient else ''
                    comm_type = 'internal' if sender_domain == 'enron.com' and receiver_domain == 'enron.com' else 'external'
                    
                    comms.append({
                        'sender_email': sender,
                        'receiver_email': recipient,
                        'message_id': row['message_id'],
                        'timestamp': row['timestamp'],
                        'communication_type': comm_type
                    })
        
        self.comms_df = pd.DataFrame(comms).drop_duplicates()
        freq = self.comms_df.groupby(['sender_email', 'receiver_email']).size().reset_index(name='communication_frequency')
        self.comms_df = self.comms_df.merge(freq, on=['sender_email', 'receiver_email'], how='left')
        
        self.logger.info(f"Extracted {len(self.comms_df):,} relationships")
        return self
    
    def create_aggregated_edges(self):
        """Create aggregated communication edge dataset."""
        self.logger.info("Creating aggregated edges...")
        
        agg_data = self.comms_df.groupby(['sender_email', 'receiver_email']).agg({
            'timestamp': ['min', 'max', 'count'],
            'communication_type': 'first'
        }).reset_index()
        
        agg_data.columns = ['sender_email', 'receiver_email', 'first_contact', 'last_contact', 
                            'communication_frequency', 'communication_type']
        agg_data['temporal_span_days'] = (agg_data['last_contact'] - agg_data['first_contact']).dt.days
        
        self.agg_comms_df = agg_data
        self.logger.info(f"Created {len(self.agg_comms_df):,} aggregated edges")
        return self
    
    def create_entities(self):
        """Create employee entities with names."""
        self.logger.info("Creating entities...")
        
        # Collect unique emails
        emails = set(self.df['from'].unique()) | set(self.comms_df['sender_email'].unique()) | set(self.comms_df['receiver_email'].unique())
        emails.discard('')
        
        # Create employee table with names
        employee_data = []
        for email in sorted(emails):
            name_matches = self.df[self.df['from'] == email]['x_from'].dropna()
            employee_name = name_matches.iloc[0] if len(name_matches) > 0 else ''
            
            employee_data.append({
                'employee_id': hashlib.md5(email.encode()).hexdigest()[:16],
                'email_address': email,
                'employee_name': employee_name
            })
        
        self.employees_df = pd.DataFrame(employee_data)
        
        # Enforce referential integrity
        valid_emails = set(self.employees_df['email_address'])
        self.comms_df = self.comms_df[
            (self.comms_df['sender_email'].isin(valid_emails)) &
            (self.comms_df['receiver_email'].isin(valid_emails))
        ]
        
        self.logger.info(f"Created {len(self.employees_df):,} employees")
        return self
    
    def compute_employee_metrics(self):
        """Compute employee-level communication metrics."""
        self.logger.info("Computing employee metrics...")
        
        # Aggregate metrics
        metrics = {
            'emails_sent_count': self.df.groupby('from').size(),
            'emails_received_count': self.comms_df.groupby('receiver_email').size(),
            'sent_to_count': self.comms_df.groupby('sender_email')['receiver_email'].nunique(),
            'received_from_count': self.comms_df.groupby('receiver_email')['sender_email'].nunique(),
            'internal_contacts_sent': self.comms_df[self.comms_df['communication_type'] == 'internal'].groupby('sender_email')['receiver_email'].nunique(),
            'external_contacts_sent': self.comms_df[self.comms_df['communication_type'] == 'external'].groupby('sender_email')['receiver_email'].nunique()
        }
        
        # Merge all metrics
        for name, data in metrics.items():
            col_name = 'email_address' if name == 'emails_sent_count' else 'email_address'
            index_name = 'from' if name == 'emails_sent_count' else ('receiver_email' if 'received' in name else 'sender_email')
            df_temp = data.reset_index(name=name).rename(columns={index_name: col_name})
            self.employees_df = self.employees_df.merge(df_temp, on=col_name, how='left')
        
        # Fill NaN and calculate total unique contacts
        metric_cols = list(metrics.keys())
        self.employees_df[metric_cols] = self.employees_df[metric_cols].fillna(0).astype(int)
        self.employees_df['unique_contacts_count'] = self.employees_df['sent_to_count'] + self.employees_df['received_from_count']
        
        self.logger.info(f"Computed metrics for {len(self.employees_df):,} employees")
        return self
    
    def enrich_features(self):
        """Add analytical features."""
        self.logger.info("Enriching features...")
        
        self.df['email_length'] = self.df['body_cleaned'].str.len().fillna(0)
        self.df['word_count'] = self.df['body_cleaned'].str.split().str.len().fillna(0)
        
        # Time categories
        time_map = {range(5, 12): "Morning", range(12, 17): "Afternoon", 
                    range(17, 21): "Evening"}
        self.df['communication_time_category'] = self.df['hour'].apply(
            lambda h: next((v for k, v in time_map.items() if h in k), "Night")
        )
        
        # Tokenize
        self.df['body_tokenized'] = self.df['body_cleaned'].apply(
            lambda text: ' '.join([t for t in re.findall(r'\b[a-zA-Z]+\b', str(text).lower()) 
                                  if t not in self.stopwords and len(t) > 2]) if text else ""
        )
        
        self.logger.info("Features enriched")
        return self
    
    def validate(self) -> Dict:
        """Validate data integrity."""
        self.logger.info("Validating...")
        
        errors = []
        
        # Core validations
        checks = [
            (self.df['message_id'].duplicated().sum() > 0, "Duplicate Message-IDs found"),
            (not self.employees_df['email_address'].str.match(self.email_pattern).all(), "Invalid email addresses"),
            (self.df['timestamp'].isna().sum() > 0, "Null timestamps found"),
            (self.df['year'].min() < 1995 or self.df['year'].max() > 2005, "Emails outside 1995-2005 range"),
            (not hasattr(self, 'agg_comms_df'), "Aggregated communications not created"),
            ('employee_name' not in self.employees_df.columns, "Employee names not extracted"),
            (not all(col in self.df.columns for col in ['body_raw', 'body_stage1', 'body_stage2', 'body_cleaned']), "Layered cleaning stages missing"),
            ('communication_type' not in self.comms_df.columns, "Communication type classification missing"),
            (not all(col in self.employees_df.columns for col in ['emails_sent_count', 'emails_received_count', 'unique_contacts_count']), "Employee metrics missing")
        ]
        
        errors = [msg for check, msg in checks if check]
        
        metrics = {
            'total_employees': len(self.employees_df),
            'total_emails': len(self.df),
            'total_communications': len(self.comms_df),
            'total_aggregated_edges': len(self.agg_comms_df) if hasattr(self, 'agg_comms_df') else 0,
            'internal_comms': (self.comms_df['communication_type'] == 'internal').sum(),
            'external_comms': (self.comms_df['communication_type'] == 'external').sum()
        }
        
        if errors:
            self.logger.error(f"Validation failed: {errors}")
        else:
            self.logger.info("✓ Validation passed")
        
        for k, v in metrics.items():
            self.logger.info(f"{k}: {v:,}")
        
        self.validation_results = {'passed': len(errors) == 0, 'errors': errors, 'metrics': metrics}
        return self
    
    def export(self):
        """Export processed datasets."""
        self.logger.info("Exporting...")
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Export datasets
        exports = {
            'employees.csv': self.employees_df,
            'emails.csv': self.df[['message_id', 'timestamp', 'from', 'to', 'subject', 
                                   'body_raw', 'body_stage1', 'body_stage2', 'body_cleaned',
                                   'year', 'month', 'day', 'hour', 'weekday']].rename(columns={'from': 'sender'}),
            'communications.csv': self.comms_df,
            'aggregated_communications.csv': self.agg_comms_df,
            'email_enrichment_features.csv': self.df[['message_id', 'email_length', 'word_count', 'communication_time_category']],
            'employee_metrics.csv': self.employees_df[['employee_id', 'email_address', 'employee_name', 
                                                       'emails_sent_count', 'emails_received_count', 
                                                       'unique_contacts_count', 'internal_contacts_sent', 
                                                       'external_contacts_sent']]
        }
        
        for filename, df in exports.items():
            df.to_csv(f"{self.output_dir}/{filename}", index=False, encoding='utf-8')
        
        self.logger.info(f"✓ Exported to {self.output_dir}/")
        return self
    
    def run(self):
        """Execute complete pipeline."""
        self.logger.info("=" * 80)
        self.logger.info("STARTING ENHANCED PIPELINE")
        self.logger.info("=" * 80)
        
        (self.load_data()
            .parse_emails()
            .clean_data()
            .extract_relationships()
            .create_aggregated_edges()
            .create_entities()
            .compute_employee_metrics()
            .enrich_features()
            .validate()
            .export())
        
        self.logger.info("=" * 80)
        self.logger.info("✓ PIPELINE COMPLETE")
        self.logger.info("=" * 80)
        return self


if __name__ == "__main__":
    pipeline = EnronPreprocessor(
        input_csv=r"C:\Users\padha\Desktop\Knowledgt graph\trial\emails.csv",
        output_dir="final_dataset"
    )
    pipeline.run()
