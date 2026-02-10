import { Octokit } from '@octokit/rest';
import { config } from '../../config/env.js';
import { retry } from '../../lib/retry.js';
import { createChildLogger } from '../../lib/logger.js';
import type { CommitPhotoParams, CommitResult } from './types.js';

const log = createChildLogger('github');

const octokit = new Octokit({ auth: config.GITHUB_TOKEN });

function parseRepo(repo: string): { owner: string; repo: string } {
  const [owner, repoName] = repo.split('/');
  if (!owner || !repoName) {
    throw new Error(`Invalid repo format: "${repo}". Expected "owner/repo".`);
  }
  return { owner, repo: repoName };
}

/**
 * Commit a project photo and its Astro content file in a single atomic commit.
 *
 * Uses the Git Data API to create a multi-file commit:
 * 1. Get current HEAD commit + tree
 * 2. Create blobs for image (base64) and markdown
 * 3. Create new tree with both files
 * 4. Create commit pointing to new tree
 * 5. Update HEAD ref
 */
export async function commitProjectPhoto(
  params: CommitPhotoParams,
): Promise<CommitResult> {
  const { owner, repo } = parseRepo(params.repo);
  const branch = 'main';

  log.info({ owner, repo, imageName: params.imageName }, 'Committing photo to GitHub');

  return retry(
    async () => {
      // 1. Get the current HEAD ref
      const { data: ref } = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`,
      });
      const currentCommitSha = ref.object.sha;

      // 2. Get the current commit's tree
      const { data: currentCommit } = await octokit.git.getCommit({
        owner,
        repo,
        commit_sha: currentCommitSha,
      });
      const baseTreeSha = currentCommit.tree.sha;

      // 3. Create blobs for both files
      const [imageBlob, markdownBlob] = await Promise.all([
        octokit.git.createBlob({
          owner,
          repo,
          content: params.imageBuffer.toString('base64'),
          encoding: 'base64',
        }),
        octokit.git.createBlob({
          owner,
          repo,
          content: params.markdownContent,
          encoding: 'utf-8',
        }),
      ]);

      // 4. Create a new tree with both files
      const imagePath = `src/content/projects/${params.imageName}`;
      const mdFileName = params.imageName.replace(/\.(jpg|jpeg|png|webp)$/i, '.md');
      const mdPath = `src/content/projects/${mdFileName}`;

      const { data: newTree } = await octokit.git.createTree({
        owner,
        repo,
        base_tree: baseTreeSha,
        tree: [
          {
            path: imagePath,
            mode: '100644',
            type: 'blob',
            sha: imageBlob.data.sha,
          },
          {
            path: mdPath,
            mode: '100644',
            type: 'blob',
            sha: markdownBlob.data.sha,
          },
        ],
      });

      // 5. Create a new commit
      const { data: newCommit } = await octokit.git.createCommit({
        owner,
        repo,
        message: params.commitMessage,
        tree: newTree.sha,
        parents: [currentCommitSha],
      });

      // 6. Update the HEAD ref to the new commit
      await octokit.git.updateRef({
        owner,
        repo,
        ref: `heads/${branch}`,
        sha: newCommit.sha,
      });

      log.info(
        { owner, repo, sha: newCommit.sha },
        'Photo committed to GitHub',
      );

      return {
        sha: newCommit.sha,
        url: newCommit.html_url,
      };
    },
    { maxAttempts: 3, baseDelay: 1000 },
  );
}

/**
 * Trigger a GitHub Actions workflow dispatch to rebuild the Astro site.
 * Only needed if the repo doesn't have a push-triggered workflow.
 */
export async function triggerWorkflowDispatch(
  repo: string,
  workflowFileName: string = 'deploy.yml',
): Promise<void> {
  const { owner, repo: repoName } = parseRepo(repo);

  log.info({ owner, repo: repoName, workflowFileName }, 'Triggering workflow dispatch');

  await retry(
    async () => {
      await octokit.actions.createWorkflowDispatch({
        owner,
        repo: repoName,
        workflow_id: workflowFileName,
        ref: 'main',
      });
    },
    { maxAttempts: 3, baseDelay: 1000 },
  );
}
