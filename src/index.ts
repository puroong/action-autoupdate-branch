import * as core from '@actions/core'
import {getOctokit, context} from '@actions/github'
import {wait} from './utils/wait'

async function getPRDetails(pr, client) {
  /*
   * We want to wait some time after master merge to get info
   * about potential conflicts because conflicts appear on PR
   * with delay
   */
  await wait(500)
  const details = await client.pulls.get({
    ...context.repo,
    pull_number: pr.number,
  })

  if (details.data.mergeable !== null) {
    return details
  } else {
    return getPRDetails(pr, client)
  }
}

async function registerAction(pr, client) {
  const {data} = await getPRDetails(pr, client)
  const requiredApprovals = parseInt(
    core.getInput('requiredApprovals') || '0',
    10
  )
  const requiredPassedChecks = core.getInput('requiredPassedChecks') === 'true'

  if (requiredPassedChecks) {
    const prBranchName = data.head.ref

    const checks = await client.checks.listForRef({
      ...context.repo,
      ref: prBranchName,
    })

    const allChecks = checks?.data?.check_runs || []
    const passedChecks = allChecks.filter(
      (check) =>
        check.status === 'completed' &&
        (check.conclusion === 'success' || check.conclusion === 'skipped')
    )

    if (allChecks.length !== passedChecks.length) {
      console.log(
        `PR #${pr.number} checks failed or still running, skipping update branch...`
      )
      return
    }
  }

  if (requiredApprovals) {
    const {data: reviews} = await client.pulls.listReviews({
      ...context.repo,
      pull_number: pr.number,
    })

    const approvals = reviews.filter((review) => review.state === 'APPROVED')

    if (approvals.length < requiredApprovals) {
      console.log(
        `PR #${pr.number} doesn't have ${requiredApprovals} approvals. Skipping update branch...`
      )
      return
    }
  }

  if (data.mergeable) {
    await client.pulls.updateBranch({
      ...context.repo,
      pull_number: pr.number,
    })
  } else {
    core.setOutput('hasConflicts', true)
    core.setOutput(
      'conflictedPullRequestJSON',
      JSON.stringify({
        title: data.title,
        url: data.html_url,
        user: {
          login: data.user.login,
          url: data.user.html_url,
          avatarUrl: data.user.avatar_url,
        },
      })
    )
  }
}

async function main() {
  const token = core.getInput('repo-token')
  const client = getOctokit(token)
  const baseBranch = context.payload.ref

  const pullsResponse = await client.pulls.list({
    ...context.repo,
    base: baseBranch,
    state: 'open',
  })

  /*
    Filter received Pull Request to get only those
    which has auto_merge enabled
   */
  const prs = (pullsResponse.data || []).filter((pr) => !!pr.auto_merge)

  const branchNames = prs.map((pr) => pr.head.ref).join(', ')
  console.log(`Will attempt to update the following branches: ${branchNames}`)

  /*
    Get details of Pull Requests and wait
    till all of them will be executed
   */
  await Promise.all(prs.map((pr) => registerAction(pr, client)))
}

main().catch((err) => `autoupdate-branch action failed: ${err}`)
