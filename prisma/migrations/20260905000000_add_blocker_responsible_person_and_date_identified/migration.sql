-- Assignment Sec 4/6: Blocker must show "Responsible person" and
-- "Date identified", distinct from raisedBy/createdAt.
ALTER TABLE "blockers" ADD COLUMN "responsiblePersonId" TEXT;
ALTER TABLE "blockers" ADD COLUMN "dateIdentified" TIMESTAMP(3);

-- Backfill existing rows: responsible person defaults to whoever raised
-- it (reassignable afterward), date identified defaults to createdAt.
UPDATE "blockers" SET "responsiblePersonId" = "raisedById" WHERE "responsiblePersonId" IS NULL;
UPDATE "blockers" SET "dateIdentified" = "createdAt" WHERE "dateIdentified" IS NULL;

ALTER TABLE "blockers" ALTER COLUMN "responsiblePersonId" SET NOT NULL;
ALTER TABLE "blockers" ALTER COLUMN "dateIdentified" SET NOT NULL;
ALTER TABLE "blockers" ALTER COLUMN "dateIdentified" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "blockers" ADD CONSTRAINT "blockers_responsiblePersonId_fkey"
  FOREIGN KEY ("responsiblePersonId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
