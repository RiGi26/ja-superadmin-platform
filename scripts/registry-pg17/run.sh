#!/usr/bin/env bash
# Isolated ENGINE_RUNTIME only. Never run this script on a workstation.
set -euo pipefail

[[ "${GITHUB_ACTIONS:-}" == true && "${RUNNER_ENVIRONMENT:-}" == github-hosted ]]
[[ "${RUNNER_OS:-}" == Linux && "${GITHUB_REPOSITORY:-}" == RiGi26/ja-superadmin-platform ]]
[[ "${GITHUB_RUN_ATTEMPT:-}" == 1 ]]
[[ "${HARNESS_SHA:-}" =~ ^[0-9a-f]{40}$ ]]
[[ "${PG17_CONTAINER_ID:-}" =~ ^[0-9a-f]{64}$ ]]
readonly SOURCE_SHA=cd9fe1e9b1a1a4c4ede55f15f16a9ef00d7b215d
readonly SOURCE_HASH=341213bfb1068d63adff71c8490233b85b1bd4d3aaeb4bfc77312c0f9d6ddf66
readonly IMAGE='postgres:17-bookworm@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826'
readonly TASK_DIR="$RUNNER_TEMP/registry-pg17-harness"
cd "$TASK_DIR"

# Recheck the live PR and source authority before any synthetic SQL execution.
python3 - <<'PY'
import json, os, urllib.request
def get(path):
    req = urllib.request.Request('https://api.github.com/repos/RiGi26/ja-superadmin-platform' + ('/' + path if path else ''),
                                 headers={'Accept':'application/vnd.github+json'})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)
with open(os.environ['GITHUB_EVENT_PATH'], encoding='utf-8') as handle:
    event = json.load(handle)
pr = event['pull_request']
sha = os.environ['HARNESS_SHA']
assert event['sender']['login'] == 'RiGi26'
assert event['label']['name'] == 'pg17-'+sha
assert pr['head']['ref'] == 'audit/registry-020-pg17-harness'
assert pr['head']['repo']['full_name'] == 'RiGi26/ja-superadmin-platform'
assert pr['head']['sha'] == sha and pr['draft'] and pr['state'] == 'open'
assert get('')['visibility'] == 'public'
live = get('pulls/'+str(pr['number']))
assert live['head']['sha'] == sha and live['draft'] and not live['merged']
assert live['base']['sha'] == '8a9ae5e7d61b706c3bd87f5516d759560876bad5'
assert any(label['name'] == 'pg17-'+sha for label in live['labels'])
assert get('branches/main')['commit']['sha'] == '8a9ae5e7d61b706c3bd87f5516d759560876bad5'
for number, expected in ((47, 'cd9fe1e9b1a1a4c4ede55f15f16a9ef00d7b215d'),
                         (46, '48fa8358f360e5b8fbe697cd08e6197f8e54df8e')):
    protected = get('pulls/'+str(number))
    assert protected['head']['sha'] == expected
    assert protected['state'] == 'open' and protected['draft'] and not protected['merged']
print('PASS public repository, exact reviewed harness head, Owner trigger, main and protected PRs')
PY

curl --fail --silent --show-error --proto '=https' --tlsv1.2 --max-time 30 \
  "https://raw.githubusercontent.com/RiGi26/ja-superadmin-platform/$SOURCE_SHA/supabase/migrations/core_db/020_company_registry_forward.sql" \
  -o source-020.sql
printf '%s  source-020.sql\n' "$SOURCE_HASH" | sha256sum --check --strict
[[ "$(wc -c < source-020.sql)" == 9360 && "$(wc -l < source-020.sql)" == 204 ]]
[[ "$(docker inspect --format '{{.Config.Image}}' "$PG17_CONTAINER_ID")" == "$IMAGE" ]]
docker inspect "$PG17_CONTAINER_ID" > container.json
python3 - <<'PY'
import json
with open('container.json', encoding='utf-8') as handle:
    container = json.load(handle)[0]
assert container['State']['Running']
assert not container['HostConfig']['Privileged']
assert not container['HostConfig'].get('PortBindings')
assert container['HostConfig']['NetworkMode'] != 'host'
assert all(mount['Type'] == 'volume' for mount in container['Mounts'])
assert len(container['Mounts']) == 1
assert container['Mounts'][0]['Destination'] == '/var/lib/postgresql/data'
print('PASS job service has no host ports, privileged mode, host network or bind mounts')
PY

pg() {
  local database="$1"; shift
  docker exec -i -e PGOPTIONS='-c statement_timeout=15000 -c lock_timeout=10000' \
    -e PGAPPNAME="${PG17_APPNAME:-registry-harness}" "$PG17_CONTAINER_ID" \
    psql -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=verbose \
    -h /var/run/postgresql -U postgres -d "$database" "$@"
}
check() {
  local name="$1" database="$2" query="$3"
  [[ "$(pg "$database" -Atc "$query")" == t ]] || { echo "FAIL $name"; return 1; }
  printf 'PASS %s\n' "$name"
}
cleanup() {
  local result=$? failed=0
  trap - EXIT
  set +e
  pg postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE
    datname IN ('registry_strict','registry_permissive','registry_atomicity')
    AND pid <> pg_backend_pid();" > cleanup.log 2>&1 || failed=1
  for database in registry_strict registry_permissive registry_atomicity; do
    docker exec "$PG17_CONTAINER_ID" dropdb -h /var/run/postgresql -U postgres \
      --if-exists "$database" >> cleanup.log 2>&1 || failed=1
  done
  check 'synthetic databases removed' postgres "SELECT NOT EXISTS
    (SELECT 1 FROM pg_database WHERE datname IN
      ('registry_strict','registry_permissive','registry_atomicity'));" || failed=1
  if [[ "$failed" != 0 ]]; then result=1; echo 'FAIL synthetic database cleanup'; fi
  {
    printf 'Registry SQL source: `%s`; SHA-256 `%s`.\n\n' "$SOURCE_SHA" "$SOURCE_HASH"
    printf 'Harness head: `%s`.\n\n' "$HARNESS_SHA"
    printf 'ENGINE_RUNTIME: %s\n\n' "$([[ "$result" == 0 ]] && echo PASS || echo FAIL)"
    printf 'SUPABASE_EQUIVALENT_RUNTIME: NOT_EXECUTED (synthetic roles/FK parents/defaults only).\n\n'
    printf 'No Production credentials/data, external database, artifact upload, cache or deployment.\n'
    printf 'Synthetic database cleanup: %s. Service disposal follows in the final workflow step.\n' \
      "$([[ "$failed" == 0 ]] && echo PASS || echo FAIL)"
  } >> "$GITHUB_STEP_SUMMARY"
  exit "$result"
}
trap cleanup EXIT

pg postgres -c "SELECT version();"
check 'PostgreSQL major version 17' postgres \
  "SELECT current_setting('server_version_num')::int / 10000 = 17;"
pg postgres <<'SQL'
CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
CREATE ROLE service_role NOLOGIN NOSUPERUSER BYPASSRLS NOCREATEROLE NOCREATEDB;
CREATE ROLE harness_owner NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
CREATE ROLE harness_readers NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
CREATE ROLE harness_session LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
GRANT anon, authenticated, service_role TO harness_session WITH INHERIT FALSE, SET TRUE;
SQL

race() {
  local name="$1" database="$2" first="$3" second="$4" count_query="$5"
  local a_pid b_pid b_status=0 ready=false
  pg "$database" -c 'TRUNCATE public.company_memberships, public.company_portal_instances;'
  (PG17_APPNAME="$name-a" pg "$database" -c "BEGIN; $first; SELECT pg_sleep(3); COMMIT;" \
    > "$name-a.log" 2>&1) & a_pid=$!
  for attempt in {1..30}; do
    if [[ "$(pg postgres -Atc "SELECT EXISTS (SELECT 1 FROM pg_stat_activity
      WHERE application_name='$name-a' AND wait_event='PgSleep');")" == t ]]; then
      ready=true; break
    fi
    sleep 0.1
  done
  [[ "$ready" == true ]] || { wait "$a_pid"; echo "FAIL $name readiness"; return 1; }
  (PG17_APPNAME="$name-b" pg "$database" -c "$second" > "$name-b.log" 2>&1) & b_pid=$!
  wait "$a_pid"
  wait "$b_pid" || b_status=$?
  [[ "$b_status" == 3 ]] && grep -q '23505' "$name-b.log" \
    || { cat "$name-a.log" "$name-b.log"; echo "FAIL $name loser"; return 1; }
  check "$name exactly one committed winner and SQLSTATE 23505 loser" "$database" "$count_query"
}

for database in registry_strict registry_permissive; do
  docker exec "$PG17_CONTAINER_ID" createdb -h /var/run/postgresql -U postgres "$database"
  pg "$database" -c "REVOKE CONNECT ON DATABASE $database FROM PUBLIC;
    GRANT CONNECT ON DATABASE $database TO harness_session;"
  permissive=false; [[ "$database" == registry_permissive ]] && permissive=true
  pg "$database" -v permissive_defaults="$permissive" < bootstrap.sql
  # Execute the unchanged BEGIN/COMMIT migration in a disposable database.
  pg "$database" < source-020.sql
  pg "$database" < assertions.sql 2>&1 | tee "$database-assertions.log"
  check "$database assertion transaction left Registry empty" "$database" \
    'SELECT (SELECT count(*) FROM public.companies)=0
      AND (SELECT count(*) FROM public.company_memberships)=0
      AND (SELECT count(*) FROM public.company_portal_instances)=0;'
  pg "$database" <<'SQL'
INSERT INTO public.companies(id,display_name,status) VALUES
 ('00000000-0000-4000-8000-000000000001','Synthetic race A','active'),
 ('00000000-0000-4000-8000-000000000002','Synthetic race B','active');
SQL
  # Independent non-superuser login; do not mistake the bootstrap admin for a client.
  for role in anon authenticated service_role; do
    statement="SELECT * FROM public.companies"
    if [[ "$role" == service_role ]]; then statement="UPDATE public.companies SET display_name='Denied'"; fi
    role_status=0
    docker exec -i "$PG17_CONTAINER_ID" psql -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=verbose \
      -h /var/run/postgresql -U harness_session -d "$database" \
      -c "SELECT session_user, current_user; SET ROLE $role; SELECT current_user; $statement;" \
      > "$database-$role.log" 2>&1 || role_status=$?
    [[ "$role_status" == 3 ]] && grep -q '42501' "$database-$role.log" \
      || { cat "$database-$role.log"; echo "FAIL $database $role client denial"; exit 1; }
    cat "$database-$role.log"
    echo "PASS $database $role denied from independent non-superuser login"
  done
  service_count=$(docker exec "$PG17_CONTAINER_ID" psql -X -qAt -v ON_ERROR_STOP=1 \
    -h /var/run/postgresql -U harness_session -d "$database" \
    -c 'SET ROLE service_role; SELECT count(*) FROM public.companies;')
  [[ "$service_count" == 2 ]]
  echo "PASS $database service SELECT through independent login"

  race "$database-membership" "$database" \
    "INSERT INTO public.company_memberships(company_id,core_auth_user_id,role,status) VALUES
     ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner','active')" \
    "INSERT INTO public.company_memberships(company_id,core_auth_user_id,role,status) VALUES
     ('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','member','active')" \
    'SELECT count(*)=1 FROM public.company_memberships;'
  race "$database-product" "$database" \
    "INSERT INTO public.company_portal_instances(company_id,portal_type,lifecycle_state,mapping_state)
     VALUES ('00000000-0000-4000-8000-000000000001','stock','active','unmapped')" \
    "INSERT INTO public.company_portal_instances(company_id,portal_type,lifecycle_state,mapping_state)
     VALUES ('00000000-0000-4000-8000-000000000001','stock','suspended','pending_proof')" \
    'SELECT count(*)=1 FROM public.company_portal_instances;'
  race "$database-core-reference" "$database" \
    "INSERT INTO public.company_portal_instances(company_id,portal_type,legacy_core_tenant_id,lifecycle_state,mapping_state)
     VALUES ('00000000-0000-4000-8000-000000000001','stock','20000000-0000-4000-8000-000000000001','active','unmapped')" \
    "INSERT INTO public.company_portal_instances(company_id,portal_type,legacy_core_tenant_id,lifecycle_state,mapping_state)
     VALUES ('00000000-0000-4000-8000-000000000002','lms','20000000-0000-4000-8000-000000000001','active','pending_proof')" \
    'SELECT count(*)=1 FROM public.company_portal_instances;'
  race "$database-portal-reference" "$database" \
    "INSERT INTO public.company_portal_instances(company_id,portal_type,portal_tenant_id,lifecycle_state,mapping_state)
     VALUES ('00000000-0000-4000-8000-000000000001','stock','30000000-0000-4000-8000-000000000001','active','unmapped')" \
    "INSERT INTO public.company_portal_instances(company_id,portal_type,portal_tenant_id,lifecycle_state,mapping_state)
     VALUES ('00000000-0000-4000-8000-000000000002','stock','30000000-0000-4000-8000-000000000001','active','pending_proof')" \
    'SELECT count(*)=1 FROM public.company_portal_instances;'
done

docker exec "$PG17_CONTAINER_ID" createdb -h /var/run/postgresql -U postgres registry_atomicity
pg registry_atomicity -v permissive_defaults=false < bootstrap.sql
pg registry_atomicity -c 'CREATE TABLE public.company_memberships(sentinel integer);'
atomic_status=0
pg registry_atomicity < source-020.sql > atomicity.log 2>&1 || atomic_status=$?
[[ "$atomic_status" == 3 ]] && grep -q '42P07' atomicity.log \
  || { cat atomicity.log; echo 'FAIL expected mid-migration object conflict'; exit 1; }
check 'mid-migration conflict rolls back all newly created objects' registry_atomicity \
  "SELECT to_regclass('public.companies') IS NULL
    AND to_regclass('public.company_portal_instances') IS NULL
    AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public'
      AND table_name='company_memberships' AND column_name='sentinel')=1
    AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public'
      AND table_name='company_memberships')=1;"
echo 'PASS ENGINE_RUNTIME suites complete; Supabase equivalence not tested'
