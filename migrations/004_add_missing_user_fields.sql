-- Ajout des champs manquants à la table Users
ALTER TABLE "Users" 
ADD COLUMN IF NOT EXISTS "biography" TEXT,
ADD COLUMN IF NOT EXISTS "languages" JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "consultationPrice" DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "availability" JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "emailVerificationToken" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "profileCompleted" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "profilePicture" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(50) DEFAULT 'Europe/Paris',
ADD COLUMN IF NOT EXISTS "preferences" JSONB DEFAULT '{
  "notifications": {
    "email": true,
    "sms": false,
    "push": true
  },
  "language": "fr",
  "theme": "light"
}'::jsonb,
ADD COLUMN IF NOT EXISTS "lastPasswordChange" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Mettre à jour les champs existants
UPDATE "Users" SET 
  "languages" = '["fr"]'::jsonb,
  "preferences" = '{
    "notifications": {
      "email": true,
      "sms": false,
      "push": true
    },
    "language": "fr",
    "theme": "light"
  }'::jsonb,
  "lastPasswordChange" = "createdAt"
WHERE "languages" IS NULL;