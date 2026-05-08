-- supabase/tests/0007_jsonb_concat_order.sql
-- Smoke SQL test for jsonb_concat_sections_pt_br ordering invariant.
-- Pitfall 1 (07-RESEARCH.md): lexicographic ordering puts '13_' BEFORE '2_'
-- because '1' < '2' char-wise. The function must use numeric cast on the
-- prefix to produce the expected order 1, 2, …, 13, encerramento.
--
-- Run: psql "$DATABASE_URL" -f supabase/tests/0007_jsonb_concat_order.sql
-- Expected: all DO blocks complete without RAISE EXCEPTION.

\echo 'Test 1: numeric ordering 1_z, 2_y, 13_x, encerramento'
do $$
declare
  result text;
  expected text := 'a' || E'\n\n' || 'b' || E'\n\n' || 'c' || E'\n\n' || 'd';
begin
  select jsonb_concat_sections_pt_br(jsonb_build_object(
    '13_x', 'c',
    '2_y', 'b',
    '1_z', 'a',
    'encerramento_disclaimer', 'd'
  )) into result;
  if result is distinct from expected then
    raise exception 'Test 1 FAIL: expected % got %', expected, result;
  end if;
  raise notice 'Test 1 PASS';
end $$;

\echo 'Test 2: full 14-key canonical shape'
do $$
declare
  input jsonb;
  result text;
  expected_first text := 'um';
  expected_last text := 'fim';
  parts text[];
begin
  input := jsonb_build_object(
    '1_constituicao', 'um',
    '2_estrutural_fisica', 'dois',
    '3_indicacoes_sistemicas', 'tres',
    '4_toxemia', 'quatro',
    '5_psicoemocional', 'cinco',
    '6_cargas_temporais', 'seis',
    '7_carencias_nutricionais', 'sete',
    '8_simbolico_espiritual', 'oito',
    '9_cuidados_integrativos', 'nove',
    '10_potenciais_forcas', 'dez',
    '11_afirmacoes_integracao', 'onze',
    '12_sintese_integrativa', 'doze',
    '13_mensagem_final', 'treze',
    'encerramento_disclaimer', 'fim'
  );
  select jsonb_concat_sections_pt_br(input) into result;
  parts := string_to_array(result, E'\n\n');
  if array_length(parts, 1) <> 14 then
    raise exception 'Test 2 FAIL: expected 14 parts, got %', array_length(parts, 1);
  end if;
  if parts[1] is distinct from expected_first then
    raise exception 'Test 2 FAIL: first element should be % got %', expected_first, parts[1];
  end if;
  if parts[14] is distinct from expected_last then
    raise exception 'Test 2 FAIL: last element should be % got %', expected_last, parts[14];
  end if;
  raise notice 'Test 2 PASS (14 parts, first=%, last=%)', parts[1], parts[14];
end $$;

\echo 'Test 3: empty jsonb returns NULL (string_agg over zero rows)'
do $$
declare
  result text;
begin
  select jsonb_concat_sections_pt_br('{}'::jsonb) into result;
  if result is not null then
    raise exception 'Test 3 FAIL: expected NULL, got %', result;
  end if;
  raise notice 'Test 3 PASS';
end $$;

\echo 'All smoke tests passed.'
