# <!--name-->With post step<!--/name-->
[![usages](https://img.shields.io/badge/usages-white?logo=githubactions&logoColor=blue)](https://github.com/search?q=elastic%2Fci-gh-actions%2Fwith-post-step+%28path%3A.github%2Fworkflows+OR+path%3A**%2Faction.yml+OR+path%3A**%2Faction.yaml%29&type=code)

<!--description-->
Generic JS Action to execute a main command and set a command as a post step.
<!--/description-->
## Inputs
<!--inputs-->
| Name              | Description                                              | Required | Default |
|-------------------|----------------------------------------------------------|----------|---------|
| `main`            | Main command/script.                                     | `true`   | ` `     |
| `post`            | Post command/script.                                     | `true`   | ` `     |
| `key`             | Name of the state variable used to detect the post step. | `false`  | `POST`  |
| `ephemeral-token` | Ephemeral GitHub Token to be revoked on the post step.   | `false`  | ` `     |
<!--/inputs-->
## Outputs
<!--outputs-->
| Name | Description |
|------|-------------|
<!--/outputs-->
## Usage
<!--usage action="your/action" version="v1"-->
```yaml
on: push
steps:
  - uses: elastic/ci-gh-actions/with-post-step@v1.1
    with:
      main: echo "Token retrieved successfully"
      post: node ${{ github.action_path }}/../fetch-github-token/dist/index.cjs
```
<!--/usage-->
