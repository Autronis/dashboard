-- Voeg type kolom toe aan screen_time_samenvattingen + update unique index
-- Zodat week/maand rapporten samen met dag-samenvattingen kunnen bestaan
-- voor dezelfde (gebruiker, datum) combinatie.

ALTER TABLE screen_time_samenvattingen ADD COLUMN type TEXT NOT NULL DEFAULT 'dag';

DROP INDEX IF EXISTS uniek_gebruiker_datum;
CREATE UNIQUE INDEX uniek_gebruiker_datum_type ON screen_time_samenvattingen (gebruiker_id, datum, type);
