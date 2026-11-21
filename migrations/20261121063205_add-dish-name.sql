-- 每道菜一个短菜名，点菜单和小票上只写菜名，完整论点留在菜单描述里
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS dish text;
