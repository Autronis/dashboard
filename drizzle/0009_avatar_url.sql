-- Voeg avatar_url kolom toe aan gebruikers
-- Vervangt de hardcoded profielfoto-mapping in header.tsx en tab-overzicht.tsx
ALTER TABLE gebruikers ADD COLUMN avatar_url TEXT;

-- Seed bestaande gebruikers met hun huidige foto paden
UPDATE gebruikers SET avatar_url = '/foto-sem.jpg' WHERE id = 1;
UPDATE gebruikers SET avatar_url = '/foto-syb.jpg' WHERE id = 2;
