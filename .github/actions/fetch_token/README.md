# fetch_token GitHub Action

This directory contains a custom GitHub Action defined in [`action.yml`].

## Purpose

The `action.yml` file describes the **fetch_token** action, which is used to retrieve and output an ephemeral GitHub token for use in GitHub workflows. This action can be integrated into your own GitHub Actions to securely fetch tokens required for accessing external services or APIs.

## Usage

To use this action in your workflow, reference it as follows:

```yaml
permissions:
  id-token: write
...
steps:
  - uses: actions/checkout@v5

  - name: Fetch ephemeral GitHub token
    id: fetch-token
    uses: elastic/ci-gh-actions/.github/actions/fetch_token@main
    with:
      vault-instance: "_name_of_the_vault_instance_of_the_role_"

  - name: Use the GitHub token using the gh cli to list the current issues of , for example.
    run: gh issue list --limit 1 --json createdAt
    env:
      GH_TOKEN: ${{ steps.fetch-token.outputs.token }}      
...
```

## Inputs & Steps

See [`action.yml`](./action.yml) for a more detailed specification of the inputs and steps of the action.
