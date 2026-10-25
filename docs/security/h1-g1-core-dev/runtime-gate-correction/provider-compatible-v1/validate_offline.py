"""Offline source, parser and trigger-policy checks. Never connects to a database.

The policy fixture checks model the candidate's JSONB equality predicate. They are
not PostgreSQL execution, managed-provider compatibility or maintenance evidence.
Private evidence inputs stay outside this package and are never printed.
"""
import argparse
import copy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sys
import unittest

import pglast

HERE = Path(__file__).resolve().parent
FROZEN = HERE.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--phase1', type=Path, required=True)
parser.add_argument('--handler-result', type=Path, required=True)
parser.add_argument('--preservation', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
sha = lambda b: hashlib.sha256(b).hexdigest()
md5 = lambda b: hashlib.md5(b).hexdigest()
read = lambda p: p.read_bytes().decode('utf-8')
names = ['PATCH.PROPOSED.sql', 'RECOVERY.PROPOSED.sql']
sqls = {n: read(HERE / n) for n in names}
old = {n: read(FROZEN / n) for n in names}
phase1_raw = args.phase1.read_bytes()
phase1_row = json.loads(phase1_raw)[0]
assert len(phase1_row['report_json'].encode()) == phase1_row['report_utf8_bytes']
assert sha(phase1_row['report_json'].encode()) == phase1_row['report_sha256']
phase1 = json.loads(phase1_row['report_json'])
observed = next(g['rows'] for g in phase1['observations'] if g['id'] == '08_applicable_event_triggers')
handler_transport = json.loads(args.handler_result.read_bytes())
handler_text = json.loads(handler_transport['content'][0]['text'])['result']
handler_rows = json.loads(re.search(r'<untrusted-data-[^>]+>\n(.*?)\n</untrusted-data-', handler_text, re.S).group(1))
assert len(handler_rows) == 1
handler = handler_rows[0]
case_results = []


def roster(sql):
    return json.loads(re.search(r'\$provider_roster\$(.*?)\$provider_roster\$', sql, re.S).group(1))


def selected(rows):
    # Catalog evtenabled is NOT NULL. NULL evttags explicitly means all tags.
    return sorted([r for r in rows if r['evtenabled'] != 'D' and
                   (r['evttags'] is None or 'CREATE FUNCTION' in r['evttags'])],
                  key=lambda r: r['evtname'])


def semantic_tree(value):
    if isinstance(value, dict):
        return {k: semantic_tree(v) for k, v in value.items()
                if k not in ('location', 'stmt_location', 'stmt_len')}
    if isinstance(value, (list, tuple)):
        return [semantic_tree(v) for v in value]
    return value


def ddl_security_ok(row, replication='origin', trigger_owners=('supabase_admin', 'supabase_admin'),
                    drop_handler_owner='supabase_admin'):
    # Extra trigger/drop ownership inputs are synthetic policy controls. Phase 1
    # did not observe them. Only DDL-handler fields below have installed evidence.
    return (replication == 'origin' and trigger_owners == ('supabase_admin', 'supabase_admin')
            and drop_handler_owner == 'supabase_admin'
            and row['handler_owner'] == 'supabase_admin'
            and row['security_definer'] is False
            and row['handler_configuration'] == ['search_path=""']
            and sha(row['handler_definition'].encode()) == '2b4b5d702ddf70fbd1a05c9825f9f9016d5c0ef97dd3df5f5b012ea23d9b94b1')


class OfflineChecks(unittest.TestCase):
    def test_01_frozen_artifacts_unchanged(self):
        for line in read(FROZEN / 'MANIFEST.sha256').splitlines():
            digest, name = line.split('  ', 1)
            self.assertEqual(sha((FROZEN / name).read_bytes()), digest, name)

    def test_02_complete_sql_and_plpgsql_parse(self):
        for name, sql in sqls.items():
            self.assertEqual(len(pglast.parse_sql(sql)), 8, name)
            self.assertEqual(len(pglast.parse_plpgsql(sql)), 1, name)

    def test_03_transaction_controls_unchanged(self):
        for name, sql in sqls.items():
            before = pglast.parse_sql(old[name])
            after = pglast.parse_sql(sql)
            for index in [0, 1, 2, 3, 4, 5, 7]:
                self.assertEqual(semantic_tree(before[index].stmt()), semantic_tree(after[index].stmt()))
            self.assertIn('BEGIN ISOLATION LEVEL READ COMMITTED;', sql)
            self.assertTrue(sql.rstrip().endswith('COMMIT;'))

    def test_04_only_authorized_provider_sections_differ(self):
        for name, sql in sqls.items():
            stripped = re.sub(r'  -- Exact observed enabled/tag-relevant roster.*?\nBEGIN\n',
                              'BEGIN\n', sql, count=1, flags=re.S)
            start = stripped.index('  -- CREATE OR REPLACE FUNCTION has command tag CREATE FUNCTION.')
            finish = stripped.index('  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p\n    WHERE p.oid = target', start)
            old_start = old[name].index('  IF EXISTS (SELECT 1 FROM pg_catalog.pg_event_trigger')
            old_finish = old[name].index('  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p\n    WHERE p.oid = target', old_start)
            stripped = stripped[:start] + old[name][old_start:old_finish] + stripped[finish:]
            start = stripped.index('  SELECT COALESCE(pg_catalog.jsonb_agg(', stripped.index('  EXECUTE after_definition;'))
            finish = stripped.index('  SELECT pg_catalog.jsonb_build_object(\n', start)
            stripped = stripped[:start] + stripped[finish:]
            stripped = stripped.replace('-- Read PACKAGE.md in this directory and ../REVIEW.md first.', '-- Read REVIEW.md first.')
            self.assertEqual(stripped, old[name], name)

    def test_05_source_pins_and_exact_body_roundtrip(self):
        baseline = (FROZEN / 'definitions/mutate.baseline.txt').read_bytes()
        corrected = (FROZEN / 'definitions/mutate.corrected.txt').read_bytes()
        for sql in sqls.values():
            for prefix, value in [('baseline', baseline), ('corrected', corrected)]:
                self.assertIn(f"expected_{prefix}_md5 constant text := '{md5(value)}';", sql)
                self.assertIn(f"expected_{prefix}_sha256 constant text := '{sha(value)}';", sql)
            anchor = re.search(r'\$anchor\$(.*?)\$anchor\$', sql, re.S).group(1).encode()
            addition = re.search(r'\$addition\$(.*?)\$addition\$', sql, re.S).group(1).encode()
            self.assertEqual(len(addition), 165)
            self.assertEqual(baseline.count(anchor), 1)
            self.assertEqual(baseline.replace(anchor, anchor + addition), corrected)
            self.assertEqual(corrected.replace(anchor + addition, anchor), baseline)

    def test_06_known_roster_matches_actual_accepted_phase1(self):
        self.assertEqual(len(observed), 2)
        for sql in sqls.values():
            self.assertEqual(roster(sql), sorted(observed, key=lambda r: r['evtname']))
            self.assertEqual(selected(observed), roster(sql))
        self.assertTrue(selected(observed), 'Frozen EXISTS predicate rejects these two records')
        case_results.append({'case': 'accepted_two_trigger_roster', 'expected': 'ALLOW_ROSTER_ONLY', 'result': 'PASS'})

    def test_07_unknown_relevant_trigger_blocked(self):
        for event in ['ddl_command_start', 'ddl_command_end', 'sql_drop', 'table_rewrite', 'login']:
            for tags in [None, ['CREATE FUNCTION']]:
                extra = dict(observed[0], evtname='unreviewed', evtevent=event, evttags=tags)
                rows = observed + [extra]
                self.assertNotEqual(selected(rows), roster(sqls[names[0]]))
                case_results.append({'case': f'unknown_{event}_{tags}', 'expected': 'STOP', 'result': 'PASS'})

    def test_08_missing_disabled_or_changed_mode_blocked(self):
        expected = roster(sqls[names[0]])
        for index in range(2):
            self.assertNotEqual(selected(observed[:index] + observed[index + 1:]), expected)
            for mode in ['D', 'R', 'A']:
                rows = copy.deepcopy(observed)
                rows[index]['evtenabled'] = mode
                self.assertNotEqual(selected(rows), expected)
                case_results.append({'case': f'trigger_{index}_mode_{mode}', 'expected': 'STOP', 'result': 'PASS'})

    def test_09_changed_event_tags_identity_or_definition_blocked(self):
        expected = roster(sqls[names[0]])
        for index in range(2):
            for key, value in [('evtevent', 'ddl_command_start'), ('evttags', ['CREATE FUNCTION']),
                               ('handler', 'public.pgrst_ddl_watch()'), ('evtname', 'renamed_provider'),
                               ('handler_definition_md5', '0' * 32)]:
                rows = copy.deepcopy(observed)
                rows[index][key] = value
                self.assertNotEqual(selected(rows), expected)
                case_results.append({'case': f'trigger_{index}_drift_{key}', 'expected': 'STOP', 'result': 'PASS'})

    def test_10_unrelated_tag_and_disabled_unknown_have_no_exception(self):
        for extra in [dict(observed[0], evtname='other', evttags=['CREATE TABLE']),
                      dict(observed[0], evtname='other', evtenabled='D')]:
            self.assertEqual(selected(observed + [extra]), roster(sqls[names[0]]))
        # These cannot fire for CREATE FUNCTION in origin mode. Same candidate
        # domain as frozen predicate; this does not approve either handler.

    def test_11_accepted_handler_capture_complete_and_digest_verified(self):
        definition = handler['handler_definition'].encode()
        self.assertEqual(md5(definition), 'afaad7193dcf8f81e728d2bedb85e43e')
        self.assertEqual(md5(definition), handler['handler_definition_md5'])
        self.assertEqual(sha(definition), '2b4b5d702ddf70fbd1a05c9825f9f9016d5c0ef97dd3df5f5b012ea23d9b94b1')
        self.assertTrue(ddl_security_ok(handler))

    def test_12_handler_security_and_source_negative_controls(self):
        for key, value in [('handler_owner', 'postgres'), ('security_definer', True),
                           ('handler_configuration', None), ('handler_configuration', ['search_path=public']),
                           ('handler_definition', handler['handler_definition'] + '\n')]:
            changed = dict(handler)
            changed[key] = value
            self.assertFalse(ddl_security_ok(changed))
            case_results.append({'case': f'handler_drift_{key}_{str(value)[:20] if key != "handler_definition" else "changed"}',
                                 'expected': 'STOP', 'result': 'PASS'})

    def test_13_unobserved_ownership_and_mode_requirements_fail_closed_model(self):
        for options in [dict(replication='replica'), dict(replication='local'),
                        dict(trigger_owners=('postgres', 'supabase_admin')),
                        dict(trigger_owners=('supabase_admin', 'postgres')),
                        dict(drop_handler_owner='postgres')]:
            self.assertFalse(ddl_security_ok(handler, **options))
        for sql in sqls.values():
            self.assertIn("current_setting('session_replication_role') <> 'origin'", sql)
            self.assertIn("e.evtowner <> 'supabase_admin'::pg_catalog.regrole", sql)
            self.assertIn("p.proowner <> 'supabase_admin'::pg_catalog.regrole", sql)
            self.assertIn("p.proconfig IS NOT DISTINCT FROM ARRAY['search_path=\"\"']::text[]", sql)
            self.assertIn('= expected_ddl_handler_sha256', sql)
        case_results.append({'case': 'additional_ownership_gates', 'expected': 'POLICY_ONLY_NOT_PROVIDER_OBSERVATION', 'result': 'PASS'})

    def test_14_provider_before_after_capture_symmetric_and_checked(self):
        for sql in sqls.values():
            captures = re.findall(r'  SELECT COALESCE\(pg_catalog.jsonb_agg\(.*?ANY\(e.evttags\)\);\n', sql, re.S)
            self.assertEqual(len(captures), 2)
            self.assertEqual(captures[0].replace('provider_before', 'provider_after').replace(
                'provider_metadata_before', 'provider_metadata_after'), captures[1])
            self.assertLess(sql.index('provider_before IS DISTINCT FROM expected_provider'), sql.index('EXECUTE after_definition;'))
            self.assertLess(sql.index('EXECUTE after_definition;'), sql.index('provider_after IS DISTINCT FROM provider_before'))
            self.assertIn('provider_metadata_after IS DISTINCT FROM provider_metadata_before', sql)
            self.assertIn("'handler_metadata', pg_catalog.to_jsonb(p) - 'prosrc'", sql)

    def test_15_guard_shape_covers_all_unknown_relevant_events(self):
        for sql in sqls.values():
            for block in re.findall(r'  SELECT COALESCE\(pg_catalog.jsonb_agg\(.*?ANY\(e.evttags\)\);\n', sql, re.S):
                self.assertIn("WHERE e.evtenabled <> 'D'", block)
                self.assertIn("AND (e.evttags IS NULL OR 'CREATE FUNCTION' = ANY(e.evttags))", block)
                self.assertNotIn("AND e.evtevent", block)
                self.assertNotIn('LIMIT ', block)
            self.assertIn('IF provider_before IS DISTINCT FROM expected_provider THEN', sql)

    def test_16_no_new_persistent_or_trigger_statements(self):
        for name, sql in sqls.items():
            self.assertEqual(sql.count('  EXECUTE after_definition;'), 1)
            # Full byte equality outside the provider blocks is established by 04.
            provider = sql[sql.index('  -- CREATE OR REPLACE FUNCTION has command tag'):sql.index('  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p\n    WHERE p.oid = target')]
            for text in ['ALTER EVENT TRIGGER', 'DISABLE', 'SET ROLE', 'SET SESSION', 'GRANT ', 'REVOKE ', 'UPDATE ', 'DELETE ', 'INSERT ', 'DROP ']:
                self.assertNotIn(text, provider)
            self.assertNotIn('EXCEPTION WHEN', sql)
            self.assertEqual(sql.count('EXECUTE after_definition'), old[name].count('EXECUTE after_definition'))

    def test_17_untouched_worktree_files_preserved(self):
        root = FROZEN.parents[3]
        before = json.loads(args.preservation.read_bytes())
        for name, digest in before.items():
            self.assertEqual(sha((root / name).read_bytes()), digest, name)


if __name__ == '__main__':
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(OfflineChecks)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    report = {
        'checked_at_utc': datetime.now(timezone.utc).isoformat(),
        'status': 'PASS' if result.wasSuccessful() else 'FAIL',
        'checks_run': result.testsRun, 'failures': len(result.failures), 'errors': len(result.errors),
        'validation_levels': {'STATIC': 'PASS' if result.wasSuccessful() else 'FAIL',
                              'OFFLINE_UNIT_POLICY_MODEL': 'PASS' if result.wasSuccessful() else 'FAIL',
                              'INTEGRATION': 'NOT_EXECUTED', 'DB_RUNTIME_NEW_CANDIDATES': 'NOT_EXECUTED',
                              'DEV_SQL': 'NOT_EXECUTED', 'PRODUCTION': 'NOT_EXECUTED'},
        'parser': {'python': sys.version, 'pglast': pglast.__version__,
                   'postgresql_parser': list(pglast.get_postgresql_version()),
                   'limitation': 'PostgreSQL 18.4 syntax parser; not PostgreSQL 17 runtime, binding or privileges'},
        'cases': case_results,
        'candidate_sha256': {n: sha((HERE / n).read_bytes()) for n in names},
        'private_input_sha256': {'phase1_capture': sha(phase1_raw),
                                'handler_capture': sha(args.handler_result.read_bytes()),
                                'preservation_snapshot': sha(args.preservation.read_bytes())},
        'reused_runtime': {'run_id': '39409742149', 'postgresql': '17.11', 'postgrest': '13.0.7',
                           'accepted_results': '26 PASS; baseline race reproduced and corrected race denied',
                           'scope': 'Unchanged function-body race fix only; not new wrappers/provider guards'},
        'extra_ownership_fields': 'NOT_OBSERVED; synthetic negative controls only; enforce at future authorized execution',
        'independent_review': 'Recorded separately in REVIEW.md; this runner is author validation',
    }
    args.output.write_bytes((json.dumps(report, indent=2) + '\n').encode())
    sys.exit(0 if result.wasSuccessful() else 1)
