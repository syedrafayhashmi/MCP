-- Migration: 008_add_remaining_to_apikey.sql
-- Adds the `remaining` column to the apikey table to track remaining quota

ALTER TABLE apikey ADD COLUMN remaining INTEGER;
