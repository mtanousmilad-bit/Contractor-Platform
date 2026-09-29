-- READ ONLY. Run in Supabase SQL Editor and export the single result as JSON/CSV.
-- Returns schema/security configuration, not customer rows, messages or invoices.
-- Function bodies are needed to review SECURITY DEFINER RPC authorization.
-- Check for accidentally hard-coded secrets in function bodies before sharing.
select jsonb_build_object(
  'relations', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'name', c.relname, 'kind', c.relkind,
      'rls_enabled', c.relrowsecurity, 'rls_forced', c.relforcerowsecurity,
      'options', c.reloptions,
      'view_definition', case when c.relkind in ('v', 'm') then pg_get_viewdef(c.oid, true) end
    ) order by n.nspname, c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where (n.nspname = 'public' or (n.nspname = 'storage' and c.relname in ('objects', 'buckets')))
      and c.relkind in ('r', 'p', 'v', 'm')
  ), '[]'::jsonb),
  'columns', coalesce((
    select jsonb_agg(to_jsonb(x)) from (
      select table_schema, table_name, column_name, data_type, is_nullable, column_default
      from information_schema.columns where table_schema = 'public'
      order by table_name, ordinal_position
    ) x
  ), '[]'::jsonb),
  'policies', coalesce((
    select jsonb_agg(to_jsonb(p) order by schemaname, tablename, policyname)
    from pg_policies p where schemaname in ('public', 'storage')
  ), '[]'::jsonb),
  'table_grants', coalesce((
    select jsonb_agg(to_jsonb(x)) from (
      select grantee, table_schema, table_name, privilege_type
      from information_schema.table_privileges
      where table_schema in ('public', 'storage') and grantee in ('anon', 'authenticated', 'PUBLIC')
      order by table_schema, table_name, grantee, privilege_type
    ) x
  ), '[]'::jsonb),
  'column_grants', coalesce((
    select jsonb_agg(to_jsonb(x)) from (
      select grantee, table_schema, table_name, column_name, privilege_type
      from information_schema.column_privileges
      where table_schema = 'public' and grantee in ('anon', 'authenticated', 'PUBLIC')
      order by table_name, column_name, grantee, privilege_type
    ) x
  ), '[]'::jsonb),
  'constraints', coalesce((
    select jsonb_agg(jsonb_build_object(
      'table', c.conrelid::regclass::text, 'name', c.conname,
      'definition', pg_get_constraintdef(c.oid)
    )) from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conrelid <> 0
  ), '[]'::jsonb),
  'functions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'name', p.proname, 'arguments', pg_get_function_identity_arguments(p.oid),
      'security_definer', p.prosecdef, 'settings', p.proconfig,
      'anon_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
      'authenticated_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      'definition', pg_get_functiondef(p.oid)
    ) order by p.proname)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass
        and d.objid = p.oid and d.deptype = 'e')
  ), '[]'::jsonb),
  'triggers', coalesce((
    select jsonb_agg(jsonb_build_object('name', t.tgname, 'definition', pg_get_triggerdef(t.oid)))
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal and n.nspname in ('public', 'auth')
  ), '[]'::jsonb),
  'storage_buckets', coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'public', public,
      'file_size_limit', file_size_limit, 'allowed_mime_types', allowed_mime_types))
    from storage.buckets
  ), '[]'::jsonb)
) as access_review;
