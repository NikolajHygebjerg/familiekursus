-- Kør hvis migrering giver "permission denied for table fk_records"

grant usage on schema public to postgres, service_role;
grant select, insert, update, delete on public.fk_records to service_role;
grant select, insert, update, delete on public.fk_table_schema to service_role;
