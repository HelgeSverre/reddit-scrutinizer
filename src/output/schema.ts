import { z } from "zod";

export const AwardSchema = z.object({
  icon: z.string(),
  label: z.string(),
  count: z.number(),
});

export const PostSchema = z.object({
  id: z.string(),
  title: z.string(),
  body_md: z.string(),
  body_html: z.string(),
  author: z.string(),
  author_flair: z.string().nullable(),
  post_flair: z.string().nullable(),
  score: z.number(),
  upvote_ratio: z.number(),
  created_utc: z.number(),
  awards: z.array(AwardSchema),
});

export const CommentSchema = z.object({
  id: z.string(),
  parent_id: z.string(),
  author: z.string(),
  author_flair: z.string().nullable(),
  is_op: z.boolean(),
  body_md: z.string(),
  body_html: z.string(),
  score: z.number(),
  controversiality: z.union([z.literal(0), z.literal(1)]),
  created_utc: z.number(),
  depth: z.number(),
  is_deleted: z.boolean(),
});

export const SubredditSchema = z.object({
  name: z.string(),
  display: z.string(),
});

export const ProjectFactsSchema = z.object({
  has_tests: z.boolean(),
  has_ci: z.boolean(),
  license: z.string().nullable(),
  files_scanned: z.number(),
  readme_excerpt: z.string(),
});

export const LanguageSchema = z.object({
  name: z.string(),
  pct: z.number(),
});

export const ProjectSchema = z.object({
  name: z.string(),
  tagline: z.string(),
  languages: z.array(LanguageSchema),
  stack: z.array(z.string()),
  facts: ProjectFactsSchema,
});

export const InputSchema = z.object({
  path: z.string(),
  subreddit: z.string(),
  model: z.string(),
  comments: z.number(),
  max_depth: z.number(),
  max_replies: z.number(),
  style: z.string(),
  seed: z.number().nullable(),
});

export const ToolSchema = z.object({
  name: z.literal("reddit-scrutinizer"),
  version: z.string(),
});

export const SimulationSchema = z.object({
  subreddit: SubredditSchema,
  post: PostSchema,
  comments: z.array(CommentSchema),
});

export const ScrutinyOutputSchema = z.object({
  schema_version: z.literal("1.0"),
  generated_at: z.string(),
  tool: ToolSchema,
  input: InputSchema,
  project: ProjectSchema,
  simulation: SimulationSchema,
});

export type Award = z.infer<typeof AwardSchema>;
export type Post = z.infer<typeof PostSchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type Subreddit = z.infer<typeof SubredditSchema>;
export type ProjectFacts = z.infer<typeof ProjectFactsSchema>;
export type Language = z.infer<typeof LanguageSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Input = z.infer<typeof InputSchema>;
export type Tool = z.infer<typeof ToolSchema>;
export type Simulation = z.infer<typeof SimulationSchema>;
export type ScrutinyOutput = z.infer<typeof ScrutinyOutputSchema>;
