DROP FUNCTION IF EXISTS public.list_item_backers(uuid, integer);
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;