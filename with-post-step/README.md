# <!--name-->With post step<!--/name-->
<!--description-->
Generic JS Action to execute a main command and set a command as a post step.
<!--/description-->
## Inputs
<!--inputs-->
| Name             | Description                                              | Required | Default |
|------------------|----------------------------------------------------------|----------|---------|
| `main`           | Main command/script.                                     | `true`   | ` `     |
| `post`           | Post command/script.                                     | `true`   | ` `     |
| `key`            | Name of the state variable used to detect the post step. | `false`  | `POST`  |
| `ephemeralToken` | Ephemeral GitHub Token to be revoked on the post step.   | `false`  | ` `     |
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
