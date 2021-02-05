import * as core from '@actions/core';
import {getOctokit, context} from '@actions/github';
import {wait} from './utils/wait';

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
        },
      };

      // FIRST - CHECK IF CAN BE MERGED
      while (detailedPr.data.mergeable === null) {
        /*
          Need to wait, because:
          The value of the mergeable attribute can be true, false, or null. If the value is null,
          this means that the mergeability hasn't been computed yet, and a background job was started
          to compute it. Give the job a few moments to complete, and then submit the request again.
          When the job is complete, the response will include a non-null value for the mergeable attribute.

          Referenced issue: https://stackoverflow.com/questions/30619549/why-does-github-api-return-an-unknown-mergeable-state-in-a-pull-request#:~:text=The%20value%20of%20the%20mergeable,then%20submit%20the%20request%20again.
        */

        await wait(2000);

        detailedPr = await client.pulls.get({
          ...context.repo,
          pull_number: pr.number,
        });
      }

      if (detailedPr.data.mergeable === false) {
        core.setOutput('hasConflicts', true);
        core.setOutput('conflictedPullRequestJSON', JSON.stringify({title: detailedPr.data.title, url: detailedPr.data.html_url}));
      } else if (detailedPr.data.mergeable === true) {
        // UPDATE BRANCH
        await client.pulls.updateBranch({
          ...context.repo,
          pull_number: pr.number,
        });
      }
    }
  }
}

main().catch(err => `autoupdate-branch action failed: ${err}`);
