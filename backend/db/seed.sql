-- India Civic Transparency Platform — Seed Data
-- Populates tables with demo data for immediate use after cloning.

-- Ingestion log entries for seed data
INSERT INTO dataset_ingestion_log (dataset_name, dataset_source, dataset_version, record_count, status, metadata)
VALUES
    ('districts', 'seed', 'seed-v1', 10, 'completed', '{"type": "seed"}'),
    ('supreme_court', 'seed', 'seed-v1', 25, 'completed', '{"type": "seed"}'),
    ('crime_stats', 'seed', 'seed-v1', 150, 'completed', '{"type": "seed"}'),
    ('infrastructure', 'seed', 'seed-v1', 30, 'completed', '{"type": "seed"}')
ON CONFLICT (dataset_name, dataset_version) DO NOTHING;
