import { CONSTRUCTION_IMAGES_BUCKET } from "../storage/constructionImages";
import { createSupabasePublicClient } from "../supabase/public";
import { getSupabaseServiceClient } from "../supabase/server";

export const PUBLIC_CONSTRUCTION_PAGE_SIZE = 6;

export async function getPublicConstructionFeed(page = 1) {
  const currentPage = Math.max(Number(page) || 1, 1);
  const from = (currentPage - 1) * PUBLIC_CONSTRUCTION_PAGE_SIZE;
  const to = from + PUBLIC_CONSTRUCTION_PAGE_SIZE - 1;
  const supabase = createSupabasePublicClient();

  const { count, data, error } = await supabase
    .from("public_construction_posts")
    .select(
      "id, slug, title, excerpt, cover_image_url, published_at, author_name, author_avatar_url, district_name, property_name, cover_bucket_id, cover_storage_path",
      { count: "exact" }
    )
    .order("published_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  const posts = await withSignedCoverUrls(data || []);
  const total = count || 0;

  return {
    currentPage,
    pageSize: PUBLIC_CONSTRUCTION_PAGE_SIZE,
    posts,
    total,
    totalPages: Math.max(Math.ceil(total / PUBLIC_CONSTRUCTION_PAGE_SIZE), 1)
  };
}

export async function getPublicConstructionPostBySlug(slug) {
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("public_construction_posts")
    .select(
      "id, slug, title, excerpt, body, cover_image_url, published_at, created_at, author_profile_id, author_name, author_avatar_url, district_name, property_name, cover_bucket_id, cover_storage_path"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const [post] = await withSignedCoverUrls([data]);
  return post;
}

export async function getPublicConstructionComments(postId) {
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("public_construction_post_comments")
    .select("id, post_id, author_profile_id, body, created_at, author_name, author_avatar_url")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(80);

  if (error) {
    throw error;
  }

  return data || [];
}

async function withSignedCoverUrls(posts) {
  const postsWithStorage = posts.filter((post) => post.cover_storage_path);

  if (!postsWithStorage.length) {
    return posts.map(normalizePost);
  }

  const serviceSupabase = getSupabaseServiceClient();
  const signedUrls = await Promise.all(
    postsWithStorage.map(async (post) => {
      const bucket = post.cover_bucket_id || CONSTRUCTION_IMAGES_BUCKET;
      const { data } = await serviceSupabase.storage
        .from(bucket)
        .createSignedUrl(post.cover_storage_path, 60 * 15);

      return [post.id, data?.signedUrl || null];
    })
  );
  const signedUrlByPost = new Map(signedUrls);

  return posts.map((post) =>
    normalizePost({
      ...post,
      cover_image_url: post.cover_image_url || signedUrlByPost.get(post.id)
    })
  );
}

function normalizePost(post) {
  return {
    ...post,
    author_name: post.author_name || "Jugador CityCraft",
    excerpt: post.excerpt || "Construccion publica registrada en el mundo CityCraft.",
    published_at: post.published_at || post.created_at
  };
}
