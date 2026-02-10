export interface CommitPhotoParams {
  repo: string; // "owner/repo" format
  imageBuffer: Buffer;
  imageName: string; // e.g., "kitchen-refit-2026-02-10.jpg"
  markdownContent: string; // Astro-compatible content file
  commitMessage: string;
}

export interface CommitResult {
  sha: string;
  url: string;
}
