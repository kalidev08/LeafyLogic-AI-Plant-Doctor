-- PostgreSQL DDL Migration Script
-- Creates treatment_prescriptions linked to AI diagnostic scan records

CREATE TABLE IF NOT EXISTS treatment_prescriptions (
    id SERIAL PRIMARY KEY,
    scan_id VARCHAR(255) NOT NULL, -- Links as a child record to the botanical scan database table
    base_chemical VARCHAR(100) NOT NULL, -- Active ingredient/agent specified (e.g. Copper Fungicide)
    exact_dosage_amount NUMERIC(6, 2) NOT NULL, -- Numerical quantity required (e.g. 4.50)
    measurement_unit VARCHAR(15) NOT NULL, -- ml, grams, drops, etc.
    dilution_water_volume NUMERIC(8, 2) NOT NULL, -- Volume of dilution water in milliliters
    application_frequency VARCHAR(255) NOT NULL, -- Schedule frequency (e.g. Once every 7 days)
    soil_type_mode VARCHAR(50) NOT NULL, -- Sandy, Clay, Loam, Potting Mix
    applied_status BOOLEAN DEFAULT FALSE NOT NULL, -- State tracker showing if user has fed/sprayed the plant
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Index search performance for fast joins
CREATE INDEX IF NOT EXISTS idx_treatment_prescriptions_scan_id ON treatment_prescriptions(scan_id);

-- Longitudinal Treatment Schema & Active Schedules
CREATE TABLE IF NOT EXISTS treatment_schedules (
    id SERIAL PRIMARY KEY,
    scan_id VARCHAR(255) NOT NULL, -- Links to the unique diagnostic session
    disease_name VARCHAR(255) NOT NULL, -- Target biological stress name
    base_chemical VARCHAR(250) NOT NULL, -- Recommended active therapeutic agent
    exact_dosage_amount NUMERIC(6, 2) NOT NULL, -- Target dose
    measurement_unit VARCHAR(15) NOT NULL, -- mL or grams
    dilution_water_volume_ml NUMERIC(8, 2) NOT NULL, -- Dilution base volume
    start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    frequency_per_day INTEGER DEFAULT 1 NOT NULL, -- Doses per 24h phase (e.g., 1 or 2)
    total_days INTEGER DEFAULT 7 NOT NULL, -- Total active treatment course length
    is_sun_sensitive BOOLEAN DEFAULT FALSE NOT NULL, -- Scorches tissues if treated in peak sun
    status VARCHAR(50) DEFAULT 'active' NOT NULL, -- 'active', 'completed', 'abandoned'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Child Physical Allocation Event Journal Table
CREATE TABLE IF NOT EXISTS treatment_logs (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER NOT NULL REFERENCES treatment_schedules(id) ON DELETE CASCADE,
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL, -- Targeted schedule slot
    actual_applied_time TIMESTAMP WITH TIME ZONE, -- When the farmer explicitly logged compliance
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexing schemas for performance, fast metrics extraction, and date range filters
CREATE INDEX IF NOT EXISTS idx_treatment_schedules_scan_id ON treatment_schedules(scan_id);
CREATE INDEX IF NOT EXISTS idx_treatment_logs_schedule_id ON treatment_logs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_treatment_logs_scheduled_time ON treatment_logs(scheduled_time);

