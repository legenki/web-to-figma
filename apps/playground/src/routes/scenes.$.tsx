import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { PlaygroundShell } from "../components/playground-shell";
import { getScene } from "../corpus";

export const Route = createFileRoute("/scenes/$")({
  component: ScenePage,
  loader: ({ params }) => {
    const scene = getScene(params._splat ?? "");
    if (!scene) {
      throw notFound();
    }
    return { scene };
  },
  notFoundComponent: SceneNotFound,
});

function ScenePage() {
  const { scene } = Route.useLoaderData();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-zinc-800 border-b px-4 py-2 text-xs">
        <Link className="text-zinc-400 hover:text-zinc-200" to="/">
          ← All scenes
        </Link>
        <span className="text-zinc-700">/</span>
        <span className="text-zinc-500">{scene.category}</span>
      </div>
      <PlaygroundShell scene={scene} />
    </div>
  );
}

function SceneNotFound() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-zinc-400">
      <div className="flex flex-col items-center gap-2">
        <p>Scene not found.</p>
        <Link className="text-orange-400 hover:text-orange-300" to="/">
          Back to gallery
        </Link>
      </div>
    </div>
  );
}
