do $$
declare
  item record;
  maximum bigint;
begin
  for item in
    select n.nspname as schema_name, c.relname as table_name, a.attname as column_name,
           pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) as sequence_name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid
     where n.nspname in ('public', 'auth') and c.relkind = 'r' and a.attnum > 0
       and pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) is not null
  loop
    execute format('select max(%I) from %I.%I', item.column_name, item.schema_name, item.table_name) into maximum;
    if maximum is null then
      perform setval(item.sequence_name, 1, false);
    else
      perform setval(item.sequence_name, maximum, true);
    end if;
  end loop;
end $$;
