import type { GeneratedPost } from "../../src/ai/generate-post";
import type { AgendaItem } from "../../src/ai/generate-agenda";
import type { GeneratedComment } from "../../src/ai/generate-comments";

export const fixturePost: GeneratedPost = {
  title: "I built a sample project - here's what I learned",
  body_md:
    "So I made this thing over the weekend. It's a simple app that does stuff.\n\n**Features:**\n- Does stuff\n- Has tests\n\nThoughts?",
  author: "sample_dev_42",
  author_flair: "TypeScript Enjoyer",
  post_flair: "Project",
};

export const fixtureAgenda: AgendaItem[] = [
  {
    topic: "Testing",
    stance: "skeptical",
    angle: "Does it actually have meaningful tests?",
    suggested_count: 3,
  },
  {
    topic: "Architecture",
    stance: "curious",
    angle: "How is the project structured?",
    suggested_count: 2,
  },
  {
    topic: "Use case",
    stance: "supportive",
    angle: "This solves a real problem",
    suggested_count: 2,
  },
];

export const fixtureComments: GeneratedComment[] = [
  {
    id: "c1",
    parent_id: "post",
    author: "senior_dev_99",
    author_flair: null,
    is_op: false,
    body_md: "Looks interesting but where are the tests?",
    depth: 0,
    is_deleted: false,
  },
  {
    id: "c2",
    parent_id: "c1",
    author: "sample_dev_42",
    author_flair: "OP",
    is_op: true,
    body_md: "Good point, I should add more coverage.",
    depth: 1,
    is_deleted: false,
  },
  {
    id: "c3",
    parent_id: "post",
    author: "helpful_commenter",
    author_flair: null,
    is_op: false,
    body_md: "Nice project! Have you considered using **Docker** for deployment?",
    depth: 0,
    is_deleted: false,
  },
  {
    id: "c4",
    parent_id: "c3",
    author: "docker_skeptic",
    author_flair: null,
    is_op: false,
    body_md: "Not everything needs Docker.",
    depth: 1,
    is_deleted: false,
  },
  {
    id: "c5",
    parent_id: "post",
    author: "[deleted]",
    author_flair: null,
    is_op: false,
    body_md: "[deleted]",
    depth: 0,
    is_deleted: true,
  },
];
