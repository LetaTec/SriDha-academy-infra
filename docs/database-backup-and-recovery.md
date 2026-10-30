# SriDha Academy (LetEd) — Database Backup & Disaster Recovery Plan

This document establishes the official database durability, backup procedures, and disaster recovery plan for the SriDha Academy PostgreSQL database.

---

## 1. Critical Operational Notice: Render Database Tier & Expiration

> [!CAUTION]
> **RENDER FREE-TIER EXPIRATION & BACKUP WARNING**
>
> 1. **30-Day Lifecycle**: Render free-tier PostgreSQL databases are ephemeral and automatically deleted **30 days after creation** (identified expiration: **November 18, 2026**). Once deleted, data cannot be recovered by Render support.
> 2. **No Automated Backups on Free Tier**: Render's automated daily snapshot service and Point-In-Time-Recovery (PITR) are **ONLY available on paid plans** (Starter tier, starting at $7/month).
> 3. **Action Required**: Prior to launching student registrations or before the 30-day limit, the database instance must be upgraded to **Starter Tier** ($7/mo) in the Render Dashboard, or an automated offsite `pg_dump` cron must be established immediately.

---

## 2. Recovery Objectives

- **Recovery Point Objective (RPO)**:
  - _Starter Tier ($7/mo)_: Maximum 24 hours of data loss (daily automated backup).
  - _Pro Tier (PITR)_: Maximum 5 minutes of data loss (continuous WAL archiving).
  - _Free Tier with Manual `pg_dump`_: Equal to the time elapsed since the last manual dump.
- **Recovery Time Objective (RTO)**:
  - Under 30 minutes to provision a replacement database and restore data.

---

## 3. Tier Comparison & Capabilities

| Feature                 | Render Free Tier           | Render Starter Tier ($7/mo)    | Render Standard/Pro Tier         |
| :---------------------- | :------------------------- | :----------------------------- | :------------------------------- |
| **Instance Expiration** | **Deletes after 30 days**  | **Persistent (No expiration)** | **Persistent (No expiration)**   |
| **Automated Backups**   | **None**                   | Daily automated snapshots      | Continuous WAL + daily snapshots |
| **Backup Retention**    | None                       | 7 daily snapshots              | 30 days retention with PITR      |
| **One-Click Restore**   | Unavailable                | Supported via Render Dashboard | Supported via Render Dashboard   |
| **RAM & CPU**           | 256 MB RAM, shared CPU     | 1 GB RAM, 0.5 CPU              | 4 GB+ RAM, dedicated CPU         |
| **Recommended Usage**   | Testing / prototyping only | Production launch minimum      | High-traffic scale               |

---

## 4. Manual Backup Procedure (`pg_dump`)

Whenever performing schema updates, migrations, or operating on an unmanaged tier, take an explicit logical dump.

### Step 1: Export Compressed Custom-Format Dump

Run from an administrative terminal with `pg_dump` (PostgreSQL 16+) installed:

```bash
# Set your connection URI (never commit this string)
export DATABASE_URL="postgres://user:password@host/dbname"

# Take the logical backup
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="sridha_prod_backup_$(date +%Y%m%d_%H%M%S).dump"
```

### Step 2: Test Backup Integrity

Verify that the dump file is uncorrupted and contains valid table schemas:

```bash
pg_restore --list sridha_prod_backup_*.dump > /dev/null
if [ $? -eq 0 ]; then
  echo "✅ Backup integrity verified successfully"
else
  echo "❌ Backup verification failed: corrupt dump file"
fi
```

### Step 3: Encrypt and Store Offsite

To protect student personal records and password hashes:

```bash
# Encrypt with GPG before uploading to S3 or Cloudflare R2
gpg --symmetric --cipher-algo AES256 sridha_prod_backup_*.dump

# Store in private bucket (e.g. AWS S3 or Cloudflare R2 with Object Lock)
aws s3 cp sridha_prod_backup_*.dump.gpg s3://sridha-academy-backups-private/
```

> [!WARNING]
> Never commit `.dump`, `.sql`, or `.gpg` files to Git. Verify that `*.dump` and `*.sql` are listed in `.gitignore`.

---

## 5. Safe Disaster Recovery & Restoration Drill

To ensure backups are recoverable without touching or endangering production data, perform this restoration drill against an isolated local or temporary test database:

### Recovery Drill Steps

1. **Spin up an empty target test database**:

   ```bash
   # Example: using local Docker PostgreSQL
   docker run --name pg-drill -e POSTGRES_PASSWORD=drillpass -p 5433:5432 -d postgres:16
   export DRILL_DATABASE_URL="postgres://postgres:drillpass@localhost:5433/postgres"
   ```

2. **Execute restoration into the drill database**:

   ```bash
   pg_restore \
     --dbname="$DRILL_DATABASE_URL" \
     --clean \
     --if-exists \
     --no-owner \
     --no-privileges \
     sridha_prod_backup_YYYYMMDD_HHMMSS.dump
   ```

3. **Verify record counts and schema integrity**:

   ```sql
   psql "$DRILL_DATABASE_URL" -c "
     SELECT 'users' as table_name, count(*) as count FROM users
     UNION ALL
     SELECT 'student_profiles', count(*) FROM student_profiles
     UNION ALL
     SELECT 'enrolments', count(*) FROM enrolments
     UNION ALL
     SELECT 'enquiries', count(*) FROM enquiries;
   "
   ```

4. **Verify application startup with restored data**:
   - Temporarily point `DATABASE_URL` in local `.env` to the drill database.
   - Run `npm run test` or start `npm run dev -w api`.
   - Verify that test accounts can authenticate with their original credentials.

5. **Clean up drill environment**:
   ```bash
   docker stop pg-drill && docker rm pg-drill
   ```

---

## 6. How to Upgrade on Render

To eliminate the 30-day expiration and enable automated backups:

1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Select PostgreSQL database `sridha-academy-db`.
3. In the database overview, click **Upgrade Plan**.
4. Select **Starter** ($7/month) or higher.
5. Click **Change Plan**.
6. Render transitions the instance with zero downtime. Automated daily backups will immediately begin appearing in the **Backups** tab.
