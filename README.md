# autoupdate-branch

[![Project Status: Active – The project has reached a stable, usable state and is being actively developed.](https://www.repostatus.org/badges/latest/active.svg)](https://www.repostatus.org/#active)

A github action to auto update labeled branches with base branch.

## Usage
- Add workflow to setup Github Actions:
```yaml
jobs:
  update-branches:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v2
      - name: Update branches
        uses: brainly/autoupdate-branch
        id: autoUpdateBranche
        with:
          repo-token: "${{ secrets.GITHUB_TOKEN }}"
          label: 'YOUR LABEL NAME'
```
- Add label to your Pull Request
- That's it, now branches with particular label will be auto updated.