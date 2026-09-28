-- ============================================================================
-- Price guide: "Similar items sell for $X–$Y" (post screen) and "Typical
-- price" (listing page), from real USD asking prices of the last 180 days
-- (live + sold ads).
--
-- price_guide(category, keywords, city) narrows by title keywords and city,
-- then widens step by step (drop city, then keywords) until it has at least
-- 5 comparable ads. Returns the 25th–75th percentile range, median and how
-- many ads it's based on, plus which scope was used. Only aggregates are
-- returned — never individual listings.
--
-- Idempotent — safe to re-run.
-- ============================================================================
create or replace function public.price_guide(
  p_category text,
  p_keywords text default null,
  p_city text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_words text[];
  v_result jsonb;
  v_scope text;
  v_try int;
begin
  if coalesce(trim(p_category), '') = '' then return null; end if;
  select array_agg(w) into v_words
  from (
    select lower(w) as w
    from regexp_split_to_table(coalesce(p_keywords, ''), '[^A-Za-z0-9]+') as w
    where length(w) >= 3
    limit 3
  ) t;

  for v_try in 1..4 loop
    v_scope := case v_try when 1 then 'keywords_city' when 2 then 'keywords' when 3 then 'category_city' else 'category' end;
    if v_try in (1, 2) and v_words is null then continue; end if;
    if v_try in (1, 3) and coalesce(trim(p_city), '') = '' then continue; end if;

    select jsonb_build_object(
      'count', count(*),
      'low', round(percentile_cont(0.25) within group (order by price)::numeric),
      'median', round(percentile_cont(0.5) within group (order by price)::numeric),
      'high', round(percentile_cont(0.75) within group (order by price)::numeric),
      'scope', v_scope
    ) into v_result
    from public.listings l
    where l.category = p_category
      and l.status in ('active', 'sold')
      and l.price > 0
      and coalesce(l.currency, 'USD') = 'USD'
      and l.created_at > now() - interval '180 days'
      and (v_try not in (1, 3) or lower(l.city) = lower(trim(p_city)))
      and (v_try not in (1, 2) or not exists (
            select 1 from unnest(v_words) w where lower(l.title) not like '%' || w || '%'));

    if (v_result ->> 'count')::int >= 5 then return v_result; end if;
  end loop;
  return null;
end;
$$;
revoke execute on function public.price_guide(text, text, text) from public;
grant execute on function public.price_guide(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
