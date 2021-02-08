import * as core from '@actions/core';
import {getOctokit, context} from '@actions/github';

async function main() {
  const token = core.getInput('repo-token');
  const label = core.getInput('label');
  const client = getOctokit(token);
  const baseBranch = context.payload.ref;

  const pullsResponse = await client.pulls.list({
    ...context.repo,
    base: baseBranch,
    state: 'open',
  });

  const prs = pullsResponse.data;

  for (const pr of prs) {
    if (pr.labels.find(prLabel => prLabel.name === label)) {
      let detailedPr = {
        data: {
          title: null,
          html_url: null,
          mergeable: null,
          user: null,
        },
      };

      const interval = setInterval(async () => {
        if (detailedPr.data.mergeable === null) {
          detailedPr = await client.pulls.get({
            ...context.repo,
            pull_number: pr.number,
          });

          return;
        }
        // remove the interval
        clearInterval(interval);

        if (detailedPr.data.mergeable === false) {
          core.setOutput('hasConflicts', true);
          core.setOutput('conflictedPullRequestJSON', JSON.stringify({
            title: detailedPr.data.title,
            url: detailedPr.data.html_url,
            user: {
              login: detailedPr.data.user.login,
              url: detailedPr.data.user.html_url,
              avatarUrl: detailedPr.data.user.avatarUrl
            }
          }));
        } else if (detailedPr.data.mergeable === true) {
          // UPDATE BRANCH
          await client.pulls.updateBranch({
            ...context.repo,
            pull_number: pr.number,
          });
        }
      }, 500);
    }
  }
}

main().catch(err => `autoupdate-branch action failed: ${err}`);
